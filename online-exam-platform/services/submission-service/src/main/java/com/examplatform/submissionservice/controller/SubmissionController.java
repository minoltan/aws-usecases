package com.examplatform.submissionservice.controller;

import com.examplatform.submissionservice.dto.SubmitResponse;
import com.examplatform.submissionservice.exception.MissingStudentIdException;
import com.examplatform.submissionservice.service.SubmissionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// X-Student-Id is set by API Gateway from the Lambda authorizer's context —
// never trust a client-supplied value for this header outside of API
// Gateway's mapping.
@RestController
@RequestMapping("/exams/{examId}")
public class SubmissionController {

    private final SubmissionService submissionService;

    public SubmissionController(SubmissionService submissionService) {
        this.submissionService = submissionService;
    }

    @PostMapping("/submit")
    public ResponseEntity<SubmitResponse> submit(@PathVariable String examId,
                                                  @RequestHeader(name = "X-Student-Id", required = false) String studentId) {
        if (studentId == null || studentId.isBlank()) {
            throw new MissingStudentIdException(
                    "Missing X-Student-Id header — request did not come through the authorizer-mapped API Gateway route");
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(submissionService.submit(studentId, examId));
    }
}
