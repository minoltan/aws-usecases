package com.examplatform.examservice.service;

import com.examplatform.examservice.config.ExamPlatformProperties;
import com.examplatform.examservice.dto.AnswerResponse;
import com.examplatform.examservice.dto.AnswerSubmission;
import com.examplatform.examservice.dto.SessionResponse;
import com.examplatform.examservice.exception.ConflictException;
import com.examplatform.examservice.exception.NotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.scheduler.SchedulerClient;
import software.amazon.awssdk.services.scheduler.model.ActionAfterCompletion;
import software.amazon.awssdk.services.scheduler.model.CreateScheduleRequest;
import software.amazon.awssdk.services.scheduler.model.FlexibleTimeWindow;
import software.amazon.awssdk.services.scheduler.model.FlexibleTimeWindowMode;
import software.amazon.awssdk.services.scheduler.model.Target;
import software.amazon.awssdk.services.sfn.SfnClient;
import software.amazon.awssdk.services.sfn.model.StartExecutionRequest;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Owns the SESSION and ANSWER items under STUDENT#&lt;id&gt; in the
 * ExamPlatform table, plus the two pieces of orchestration that start when a
 * student starts an exam: kicking off the Step Functions execution and
 * scheduling the EventBridge Scheduler one-shot that force-submits at the
 * exam's end time.
 */
@Service
public class ExamSessionService {

    private static final Logger log = LoggerFactory.getLogger(ExamSessionService.class);
    private static final DateTimeFormatter SCHEDULE_AT_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss").withZone(ZoneOffset.UTC);

    private final DynamoDbClient dynamoDbClient;
    private final SfnClient sfnClient;
    private final SchedulerClient schedulerClient;
    private final ExamPlatformProperties properties;
    private final ObjectMapper objectMapper;

    public ExamSessionService(DynamoDbClient dynamoDbClient,
                               SfnClient sfnClient,
                               SchedulerClient schedulerClient,
                               ExamPlatformProperties properties,
                               ObjectMapper objectMapper) {
        this.dynamoDbClient = dynamoDbClient;
        this.sfnClient = sfnClient;
        this.schedulerClient = schedulerClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public SessionResponse startExam(String studentId, String examId) {
        String pk = studentPk(studentId);
        String sk = sessionSk(examId);

        getSessionItem(studentId, examId).ifPresent(item -> {
            String status = attr(item, "status");
            if ("STARTED".equals(status) || "IN_PROGRESS".equals(status)) {
                throw new ConflictException("Session already started for studentId=" + studentId + " examId=" + examId);
            }
        });

        long durationSeconds = examDurationSeconds(examId);
        Instant startTime = Instant.now();
        Instant endTime = startTime.plusSeconds(durationSeconds);

        Map<String, AttributeValue> item = new HashMap<>();
        item.put("PK", AttributeValue.fromS(pk));
        item.put("SK", AttributeValue.fromS(sk));
        item.put("Type", AttributeValue.fromS("SESSION"));
        item.put("status", AttributeValue.fromS("STARTED"));
        item.put("startTime", AttributeValue.fromS(startTime.toString()));
        item.put("endTime", AttributeValue.fromS(endTime.toString()));
        item.put("timeRemaining", AttributeValue.fromN(Long.toString(durationSeconds)));
        item.put("answeredCount", AttributeValue.fromN("0"));
        item.put("ttl", AttributeValue.fromN(Long.toString(endTime.getEpochSecond() + (30L * 24 * 3600))));
        item.put("GSI1PK", AttributeValue.fromS("EXAM#" + examId));
        item.put("GSI1SK", AttributeValue.fromS("STARTED"));

        dynamoDbClient.putItem(PutItemRequest.builder()
                .tableName(properties.getTableName())
                .item(item)
                .build());

        startLifecycleExecution(pk, sk, studentId, examId);
        scheduleAutoSubmit(studentId, examId, endTime);

        log.info("Started session studentId={} examId={} endTime={}", studentId, examId, endTime);
        return new SessionResponse(studentId, examId, "STARTED", startTime, endTime, durationSeconds, 0);
    }

    public AnswerResponse saveAnswer(String studentId, String examId, AnswerSubmission submission) {
        Map<String, AttributeValue> session = getSessionItem(studentId, examId)
                .orElseThrow(() -> new NotFoundException("No session for studentId=" + studentId + " examId=" + examId));
        String status = attr(session, "status");
        if (!"STARTED".equals(status) && !"IN_PROGRESS".equals(status)) {
            throw new ConflictException("Session is not active (status=" + status + ") — cannot accept answers");
        }

        String answerSk = answerSk(examId, submission.questionId());
        Optional<Map<String, AttributeValue>> existing = getItem(studentPk(studentId), answerSk);
        int currentVersion = existing.map(i -> intAttr(i, "version", 0)).orElse(0);

        if (submission.version() != null && !submission.version().equals(currentVersion)) {
            throw new ConflictException("version conflict: expected " + currentVersion + " but got " + submission.version());
        }

        int nextVersion = currentVersion + 1;
        Instant savedAt = Instant.now();

        Map<String, AttributeValue> item = new HashMap<>();
        item.put("PK", AttributeValue.fromS(studentPk(studentId)));
        item.put("SK", AttributeValue.fromS(answerSk));
        item.put("Type", AttributeValue.fromS("ANSWER"));
        item.put("questionId", AttributeValue.fromS(submission.questionId()));
        item.put("answer", AttributeValue.fromS(submission.answer()));
        item.put("autoSaved", AttributeValue.fromBool(true));
        item.put("version", AttributeValue.fromN(Integer.toString(nextVersion)));
        item.put("savedAt", AttributeValue.fromS(savedAt.toString()));

        dynamoDbClient.putItem(PutItemRequest.builder()
                .tableName(properties.getTableName())
                .item(item)
                .build());

        if (existing.isEmpty()) {
            bumpAnsweredCount(studentId, examId);
        }

        return new AnswerResponse(submission.questionId(), submission.answer(), true, nextVersion, savedAt);
    }

    public SessionResponse getSession(String studentId, String examId) {
        Map<String, AttributeValue> item = getSessionItem(studentId, examId)
                .orElseThrow(() -> new NotFoundException("No session for studentId=" + studentId + " examId=" + examId));

        Instant endTime = Instant.parse(attr(item, "endTime"));
        Instant startTime = Instant.parse(attr(item, "startTime"));
        long timeRemaining = Math.max(0, endTime.getEpochSecond() - Instant.now().getEpochSecond());

        return new SessionResponse(
                studentId,
                examId,
                attr(item, "status"),
                startTime,
                endTime,
                timeRemaining,
                intAttr(item, "answeredCount", 0));
    }

    private void startLifecycleExecution(String pk, String sk, String studentId, String examId) {
        try {
            String input = objectMapper.writeValueAsString(Map.of(
                    "pk", pk, "sk", sk, "studentId", studentId, "examId", examId));
            sfnClient.startExecution(StartExecutionRequest.builder()
                    .stateMachineArn(properties.getStateMachineArn())
                    .name(scheduleSafeName("exec", studentId, examId) + "-" + System.currentTimeMillis())
                    .input(input)
                    .build());
        } catch (Exception e) {
            // The session row is already written; lifecycle tracking is an
            // audit trail, not a blocker for the student starting their exam.
            log.error("Failed to start Step Functions execution for studentId={} examId={}", studentId, examId, e);
        }
    }

    private void scheduleAutoSubmit(String studentId, String examId, Instant endTime) {
        try {
            String input = objectMapper.writeValueAsString(Map.of("studentId", studentId, "examId", examId));
            schedulerClient.createSchedule(CreateScheduleRequest.builder()
                    .name(scheduleSafeName("auto-submit", studentId, examId))
                    .scheduleExpression("at(" + SCHEDULE_AT_FORMAT.format(endTime) + ")")
                    .flexibleTimeWindow(FlexibleTimeWindow.builder().mode(FlexibleTimeWindowMode.OFF).build())
                    .actionAfterCompletion(ActionAfterCompletion.DELETE)
                    .target(Target.builder()
                            .arn(properties.getAutoSubmitFunctionArn())
                            .roleArn(properties.getSchedulerExecutionRoleArn())
                            .input(input)
                            .build())
                    .build());
        } catch (Exception e) {
            log.error("Failed to schedule auto-submit for studentId={} examId={}", studentId, examId, e);
        }
    }

    private long examDurationSeconds(String examId) {
        return getItem("EXAM#" + examId, "METADATA")
                .map(item -> (long) intAttr(item, "duration", (int) properties.getExamDurationSeconds()))
                .orElse(properties.getExamDurationSeconds());
    }

    private void bumpAnsweredCount(String studentId, String examId) {
        Map<String, AttributeValue> session = getSessionItem(studentId, examId).orElse(null);
        if (session == null) {
            return;
        }
        int current = intAttr(session, "answeredCount", 0);
        session.put("answeredCount", AttributeValue.fromN(Integer.toString(current + 1)));
        dynamoDbClient.putItem(PutItemRequest.builder()
                .tableName(properties.getTableName())
                .item(session)
                .build());
    }

    private Optional<Map<String, AttributeValue>> getSessionItem(String studentId, String examId) {
        return getItem(studentPk(studentId), sessionSk(examId));
    }

    private Optional<Map<String, AttributeValue>> getItem(String pk, String sk) {
        GetItemResponse response = dynamoDbClient.getItem(GetItemRequest.builder()
                .tableName(properties.getTableName())
                .key(Map.of("PK", AttributeValue.fromS(pk), "SK", AttributeValue.fromS(sk)))
                .build());
        return response.hasItem() ? Optional.of(response.item()) : Optional.empty();
    }

    private static String studentPk(String studentId) {
        return "STUDENT#" + studentId;
    }

    private static String sessionSk(String examId) {
        return "SESSION#EXAM#" + examId;
    }

    private static String answerSk(String examId, String questionId) {
        return "ANSWER#EXAM#" + examId + "#Q" + questionId;
    }

    private static String scheduleSafeName(String prefix, String studentId, String examId) {
        String raw = prefix + "-" + studentId + "-" + examId;
        return raw.replaceAll("[^A-Za-z0-9._-]", "-");
    }

    private static String attr(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        return value == null ? null : value.s();
    }

    private static int intAttr(Map<String, AttributeValue> item, String key, int defaultValue) {
        AttributeValue value = item.get(key);
        return value == null || value.n() == null ? defaultValue : Integer.parseInt(value.n());
    }
}
