#!/usr/bin/env bash
# Builds services/exam-service and services/submission-service and pushes
# both to the ECR repos ExamStack creates. Run once after the first
# `cdk deploy ExamPlatform-<env>-Exam` (the repos exist but are empty, so
# ECS tasks won't start until this has run at least once), and again on
# every app code change since there's no CI pipeline wired up yet.
#
# Usage: ENV=dev AWS_PROFILE=pearson-dev ./scripts/build-and-push-services.sh
set -euo pipefail

ENV_NAME="${ENV:-dev}"
STACK_NAME="ExamPlatform-${ENV_NAME}-Exam"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

profile_args=()
if [[ -n "${AWS_PROFILE:-}" ]]; then
  profile_args=(--profile "$AWS_PROFILE")
fi

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text \
    "${profile_args[@]}"
}

echo "Looking up ECR repo URIs from stack ${STACK_NAME}..."
EXAM_REPO_URI="$(stack_output ExamServiceRepoUri)"
SUBMISSION_REPO_URI="$(stack_output SubmissionServiceRepoUri)"

if [[ -z "$EXAM_REPO_URI" || -z "$SUBMISSION_REPO_URI" ]]; then
  echo "Could not read repo URIs from ${STACK_NAME} — has it been deployed yet?" >&2
  exit 1
fi

REGISTRY="${EXAM_REPO_URI%%/*}"
REGION="$(echo "$REGISTRY" | cut -d. -f4)"

echo "Logging in to ${REGISTRY}..."
aws ecr get-login-password --region "$REGION" "${profile_args[@]}" \
  | docker login --username AWS --password-stdin "$REGISTRY"

build_and_push() {
  local service_dir="$1" repo_uri="$2"
  echo "Building ${service_dir}..."
  docker build -t "${repo_uri}:latest" "${REPO_ROOT}/services/${service_dir}"
  echo "Pushing ${repo_uri}:latest..."
  docker push "${repo_uri}:latest"
}

build_and_push exam-service "$EXAM_REPO_URI"
build_and_push submission-service "$SUBMISSION_REPO_URI"

echo "Done. If the ECS services are already running with 0 healthy tasks, force a redeploy:"
echo "  aws ecs update-service --cluster ExamPlatformCluster --service exam-service --force-new-deployment ${profile_args[*]}"
echo "  aws ecs update-service --cluster ExamPlatformCluster --service submission-service --force-new-deployment ${profile_args[*]}"
