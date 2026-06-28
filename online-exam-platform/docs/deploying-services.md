# Deploying the Spring Boot services

`services/exam-service` and `services/submission-service` are real Java 21 / Spring Boot 3
apps (Maven, AWS SDK v2, Actuator health checks at `/actuator/health`). `ExamStack` creates an
ECR repo for each (`ExamServiceRepoUri` / `SubmissionServiceRepoUri` stack outputs) but does
**not** build or push into them — `cdk synth`/`cdk deploy` stay fast because they never invoke
Docker for these images. That means:

1. `cdk deploy ExamPlatform-<env>-Exam` creates two empty ECR repos. ECS tasks will fail to
   start (`CannotPullContainerError`) until an image exists — this is expected, not a bug.
2. Run `scripts/build-and-push-services.sh` once to push the first image:

   ```bash
   ENV=dev AWS_PROFILE=pearson-dev ./scripts/build-and-push-services.sh
   ```

   It looks up both repo URIs from the `ExamPlatform-<env>-Exam` stack's outputs, builds each
   service's Dockerfile, and pushes `:latest`. Re-run it after every app code change — there's
   no CI pipeline wired up yet (see `CLAUDE.md`'s CI/CD section).
3. If the ECS service is already running (0 healthy tasks), force it to pick up the
   newly-pushed image:

   ```bash
   aws ecs update-service --cluster ExamPlatformCluster --service exam-service --force-new-deployment
   aws ecs update-service --cluster ExamPlatformCluster --service submission-service --force-new-deployment
   ```

## Building/testing locally without Docker

```bash
cd services/exam-service && mvn test        # boots the full Spring context; AWS clients
cd services/submission-service && mvn test   # build but make no real calls during the test
```

Both `application.yml` files bind required config from env vars (`TABLE_NAME`,
`SUBMISSION_QUEUE_URL`, etc.) — the same names `ExamStack` injects into the container
definitions. Run the jar directly against a real account by exporting them yourself:

```bash
cd services/exam-service
mvn -q package -DskipTests
TABLE_NAME=ExamPlatform \
QUESTION_BUCKET=<bucket> \
STATE_MACHINE_ARN=<arn> \
SCHEDULER_EXECUTION_ROLE_ARN=<arn> \
AUTO_SUBMIT_FUNCTION_ARN=<arn> \
AWS_REGION=ap-southeast-1 \
java -jar target/exam-service.jar
```

Whatever AWS credentials are active in your shell (`AWS_PROFILE`, instance role, etc.) are what
the AWS SDK v2 default credential provider chain picks up — same as the ECS task role does in
production.
