package com.examplatform.submissionservice.exception;

public class MissingStudentIdException extends RuntimeException {
    public MissingStudentIdException(String message) {
        super(message);
    }
}
