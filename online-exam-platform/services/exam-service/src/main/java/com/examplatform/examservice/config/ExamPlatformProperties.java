package com.examplatform.examservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "examplatform")
public class ExamPlatformProperties {

    private String tableName;
    private String questionBucket;
    private String stateMachineArn;
    private String schedulerExecutionRoleArn;
    private String autoSubmitFunctionArn;
    private String awsRegion = "ap-southeast-1";
    private long examDurationSeconds = 5400;

    public String getTableName() {
        return tableName;
    }

    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    public String getQuestionBucket() {
        return questionBucket;
    }

    public void setQuestionBucket(String questionBucket) {
        this.questionBucket = questionBucket;
    }

    public String getStateMachineArn() {
        return stateMachineArn;
    }

    public void setStateMachineArn(String stateMachineArn) {
        this.stateMachineArn = stateMachineArn;
    }

    public String getSchedulerExecutionRoleArn() {
        return schedulerExecutionRoleArn;
    }

    public void setSchedulerExecutionRoleArn(String schedulerExecutionRoleArn) {
        this.schedulerExecutionRoleArn = schedulerExecutionRoleArn;
    }

    public String getAutoSubmitFunctionArn() {
        return autoSubmitFunctionArn;
    }

    public void setAutoSubmitFunctionArn(String autoSubmitFunctionArn) {
        this.autoSubmitFunctionArn = autoSubmitFunctionArn;
    }

    public String getAwsRegion() {
        return awsRegion;
    }

    public void setAwsRegion(String awsRegion) {
        this.awsRegion = awsRegion;
    }

    public long getExamDurationSeconds() {
        return examDurationSeconds;
    }

    public void setExamDurationSeconds(long examDurationSeconds) {
        this.examDurationSeconds = examDurationSeconds;
    }
}
