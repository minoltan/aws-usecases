package com.examplatform.examservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.scheduler.SchedulerClient;
import software.amazon.awssdk.services.sfn.SfnClient;

// Credentials come from the ECS task role via the default provider chain —
// no explicit credentials provider needed for any of these builders.
@Configuration
public class AwsClientConfig {

    @Bean
    public DynamoDbClient dynamoDbClient(ExamPlatformProperties props) {
        return DynamoDbClient.builder().region(Region.of(props.getAwsRegion())).build();
    }

    @Bean
    public S3Client s3Client(ExamPlatformProperties props) {
        return S3Client.builder().region(Region.of(props.getAwsRegion())).build();
    }

    @Bean
    public SfnClient sfnClient(ExamPlatformProperties props) {
        return SfnClient.builder().region(Region.of(props.getAwsRegion())).build();
    }

    @Bean
    public SchedulerClient schedulerClient(ExamPlatformProperties props) {
        return SchedulerClient.builder().region(Region.of(props.getAwsRegion())).build();
    }
}
