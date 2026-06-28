package com.examplatform.submissionservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "examplatform")
public class ExamPlatformProperties {

    private String tableName;
    private String submissionQueueUrl;
    private String awsRegion = "ap-southeast-1";

    public String getTableName() {
        return tableName;
    }

    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    public String getSubmissionQueueUrl() {
        return submissionQueueUrl;
    }

    public void setSubmissionQueueUrl(String submissionQueueUrl) {
        this.submissionQueueUrl = submissionQueueUrl;
    }

    public String getAwsRegion() {
        return awsRegion;
    }

    public void setAwsRegion(String awsRegion) {
        this.awsRegion = awsRegion;
    }
}
