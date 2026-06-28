package com.examplatform.examservice;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "TABLE_NAME=test-table",
        "QUESTION_BUCKET=test-bucket",
        "STATE_MACHINE_ARN=arn:aws:states:ap-southeast-1:111111111111:stateMachine:test",
        "SCHEDULER_EXECUTION_ROLE_ARN=arn:aws:iam::111111111111:role/test",
        "AUTO_SUBMIT_FUNCTION_ARN=arn:aws:lambda:ap-southeast-1:111111111111:function:test"
})
class ExamServiceApplicationTests {

    @Test
    void contextLoads() {
    }
}
