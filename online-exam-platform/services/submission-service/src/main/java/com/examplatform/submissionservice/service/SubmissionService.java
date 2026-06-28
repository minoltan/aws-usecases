package com.examplatform.submissionservice.service;

import com.examplatform.submissionservice.config.ExamPlatformProperties;
import com.examplatform.submissionservice.dto.SubmitResponse;
import com.examplatform.submissionservice.exception.ConflictException;
import com.examplatform.submissionservice.exception.NotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.SendMessageRequest;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * Fronts SubmissionQueue: validates the session is still active, flips its
 * status to SUBMITTED, then enqueues the attempt for result-processor
 * (Lambda) to grade asynchronously. auto-submit (Lambda) takes the same
 * queue path when the EventBridge timer fires instead of a real submit.
 */
@Service
public class SubmissionService {

    private static final Logger log = LoggerFactory.getLogger(SubmissionService.class);

    private final DynamoDbClient dynamoDbClient;
    private final SqsClient sqsClient;
    private final ExamPlatformProperties properties;
    private final ObjectMapper objectMapper;

    public SubmissionService(DynamoDbClient dynamoDbClient,
                              SqsClient sqsClient,
                              ExamPlatformProperties properties,
                              ObjectMapper objectMapper) {
        this.dynamoDbClient = dynamoDbClient;
        this.sqsClient = sqsClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public SubmitResponse submit(String studentId, String examId) {
        String pk = "STUDENT#" + studentId;
        String sk = "SESSION#EXAM#" + examId;

        Map<String, AttributeValue> session = getItem(pk, sk)
                .orElseThrow(() -> new NotFoundException("No session for studentId=" + studentId + " examId=" + examId));

        String status = session.get("status") == null ? null : session.get("status").s();
        if (!"STARTED".equals(status) && !"IN_PROGRESS".equals(status)) {
            throw new ConflictException("Exam already submitted or expired (status=" + status + ")");
        }

        Instant submittedAt = Instant.now();

        dynamoDbClient.updateItem(UpdateItemRequest.builder()
                .tableName(properties.getTableName())
                .key(Map.of("PK", AttributeValue.fromS(pk), "SK", AttributeValue.fromS(sk)))
                .updateExpression("SET #status = :status, submittedAt = :submittedAt")
                .expressionAttributeNames(Map.of("#status", "status"))
                .expressionAttributeValues(Map.of(
                        ":status", AttributeValue.fromS("SUBMITTED"),
                        ":submittedAt", AttributeValue.fromS(submittedAt.toString())))
                .build());

        try {
            String body = objectMapper.writeValueAsString(Map.of("studentId", studentId, "examId", examId));
            sqsClient.sendMessage(SendMessageRequest.builder()
                    .queueUrl(properties.getSubmissionQueueUrl())
                    .messageBody(body)
                    .build());
        } catch (Exception e) {
            // Status is already SUBMITTED; result-processor won't run without
            // the queue message, so this needs to surface loudly for ops to
            // notice and replay rather than silently leaving it ungraded.
            log.error("Submitted but failed to enqueue grading for studentId={} examId={}", studentId, examId, e);
            throw new IllegalStateException("Submission recorded but grading enqueue failed", e);
        }

        log.info("Submitted studentId={} examId={}", studentId, examId);
        return new SubmitResponse(studentId, examId, "SUBMITTED", submittedAt);
    }

    private Optional<Map<String, AttributeValue>> getItem(String pk, String sk) {
        GetItemResponse response = dynamoDbClient.getItem(GetItemRequest.builder()
                .tableName(properties.getTableName())
                .key(Map.of("PK", AttributeValue.fromS(pk), "SK", AttributeValue.fromS(sk)))
                .build());
        return response.hasItem() ? Optional.of(response.item()) : Optional.empty();
    }
}
