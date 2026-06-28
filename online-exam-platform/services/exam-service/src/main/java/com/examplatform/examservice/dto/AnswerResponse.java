package com.examplatform.examservice.dto;

import java.time.Instant;

public record AnswerResponse(
        String questionId,
        String answer,
        boolean autoSaved,
        int version,
        Instant savedAt) {
}
