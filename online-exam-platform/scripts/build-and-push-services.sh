#!/usr/bin/env bash
# Builds services/exam-service and services/submission-service and pushes
# both to the ECR repos ExamStack creates. Run once after the first
# `cdk deploy ExamPlatform-<env>-Exam` (the repos exist but are empty, so
# ECS tasks won't start until this has run at least once), and again on
# every app code change since there's no CI pipeline wired up yet.
#
# Usage: ENV=dev AWS_PROFILE=pearson-dev ./scripts/build-and-push-services.sh
# Region defaults to this project's actual region (lib/config/environment.ts) —
# override with REGION=... if you've changed that. Without an explicit
# --region, the AWS CLI falls back to your shell's default region, which may
# not be where this stack actually lives, and `describe-stacks` then silently
# finds nothing (rendered as the literal string "None" under --output text).
set -euo pipefail

ENV_NAME="${ENV:-dev}"
REGION="${REGION:-ap-southeast-1}"
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
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text \
    "${profile_args[@]}"
}

echo "Looking up ECR repo URIs from stack ${STACK_NAME} in ${REGION}..."
EXAM_REPO_URI="$(stack_output ExamServiceRepoUri)"
SUBMISSION_REPO_URI="$(stack_output SubmissionServiceRepoUri)"

if [[ -z "$EXAM_REPO_URI" || "$EXAM_REPO_URI" == "None" || -z "$SUBMISSION_REPO_URI" || "$SUBMISSION_REPO_URI" == "None" ]]; then
  echo "Could not read repo URIs from ${STACK_NAME} in ${REGION} — has it been deployed there yet? Pass REGION=... if it's deployed elsewhere." >&2
  exit 1
fi

REGISTRY="${EXAM_REPO_URI%%/*}"

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
echo "  aws ecs update-service --cluster ExamPlatformCluster --service exam-service --force-new-deployment --region ${REGION} ${profile_args[*]}"
echo "  aws ecs update-service --cluster ExamPlatformCluster --service submission-service --force-new-deployment --region ${REGION} ${profile_args[*]}"
