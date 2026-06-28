package com.examplatform.examservice.dto;

import java.time.Instant;

public record SessionResponse(
        String studentId,
        String examId,
        String status,
        Instant startTime,
        Instant endTime,
        long timeRemaining,
        int answeredCount) {
}
