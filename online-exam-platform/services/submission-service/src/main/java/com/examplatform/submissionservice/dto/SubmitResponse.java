package com.examplatform.submissionservice.dto;

import java.time.Instant;

public record SubmitResponse(
        String studentId,
        String examId,
        String status,
        Instant submittedAt) {
}
