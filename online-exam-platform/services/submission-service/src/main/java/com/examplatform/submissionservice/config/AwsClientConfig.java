package com.examplatform.submissionservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.sqs.SqsClient;

// Credentials come from the ECS task role via the default provider chain —
// no explicit credentials provider needed for either builder.
@Configuration
public class AwsClientConfig {

    @Bean
    public DynamoDbClient dynamoDbClient(ExamPlatformProperties props) {
        return DynamoDbClient.builder().region(Region.of(props.getAwsRegion())).build();
    }

    @Bean
    public SqsClient sqsClient(ExamPlatformProperties props) {
        return SqsClient.builder().region(Region.of(props.getAwsRegion())).build();
    }
}
