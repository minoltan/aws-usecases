package com.examplatform.examservice.exception;

public class MissingStudentIdException extends RuntimeException {
    public MissingStudentIdException(String message) {
        super(message);
    }
}
