package com.examplatform.examservice.controller;

import com.examplatform.examservice.dto.AnswerResponse;
import com.examplatform.examservice.dto.AnswerSubmission;
import com.examplatform.examservice.dto.SessionResponse;
import com.examplatform.examservice.exception.MissingStudentIdException;
import com.examplatform.examservice.service.ExamSessionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// X-Student-Id is set by API Gateway from the Lambda authorizer's context
// (see auth-validator's `context: { studentId }`) — never trust a
// client-supplied value for this header outside of API Gateway's mapping.
@RestController
@RequestMapping("/exams/{examId}")
public class ExamController {

    private final ExamSessionService examSessionService;

    public ExamController(ExamSessionService examSessionService) {
        this.examSessionService = examSessionService;
    }

    @PostMapping("/start")
    public SessionResponse start(@PathVariable String examId,
                                  @RequestHeader(name = "X-Student-Id", required = false) String studentId) {
        return examSessionService.startExam(requireStudentId(studentId), examId);
    }

    @PostMapping("/answers")
    public AnswerResponse saveAnswer(@PathVariable String examId,
                                      @RequestHeader(name = "X-Student-Id", required = false) String studentId,
                                      @Valid @RequestBody AnswerSubmission submission) {
        return examSessionService.saveAnswer(requireStudentId(studentId), examId, submission);
    }

    @GetMapping("/session")
    public SessionResponse getSession(@PathVariable String examId,
                                       @RequestHeader(name = "X-Student-Id", required = false) String studentId) {
        return examSessionService.getSession(requireStudentId(studentId), examId);
    }

    private String requireStudentId(String studentId) {
        if (studentId == null || studentId.isBlank()) {
            throw new MissingStudentIdException(
                    "Missing X-Student-Id header — request did not come through the authorizer-mapped API Gateway route");
        }
        return studentId;
    }
}
