package com.examplatform.submissionservice;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "TABLE_NAME=test-table",
        "SUBMISSION_QUEUE_URL=https://sqs.ap-southeast-1.amazonaws.com/111111111111/test-queue"
})
class SubmissionServiceApplicationTests {

    @Test
    void contextLoads() {
    }
}
