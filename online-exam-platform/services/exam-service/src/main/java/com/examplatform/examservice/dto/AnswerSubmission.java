package com.examplatform.examservice.dto;

import jakarta.validation.constraints.NotBlank;

public record AnswerSubmission(
        @NotBlank String questionId,
        @NotBlank String answer,
        Integer version) {
}
