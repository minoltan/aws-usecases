/**
 * Configuration constants for order processing workflow
 */

/**
 * Bedrock model configuration
 * Default: Amazon Nova Lite in us-east-1
 * Override via environment variables for other regions/models
 */
export const BEDROCK_CONFIG = {
    modelId: process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0',
    region: process.env.AWS_REGION || 'us-east-1',
    maxTokens: 100,
} as const;

/**
 * Processing delays and timeouts
 */
export const TIMEOUTS = {
    orderProcessingDelaySeconds: 10,
    paymentCallbackTimeoutMinutes: 5,
} as const;

/**
 * Payment processor function configuration
 */
export const PAYMENT_PROCESSOR = {
    functionName: process.env.PAYMENT_PROCESSOR_FUNCTION_NAME || '',
} as const;

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
    maxAttempts: 10,
    initialDelaySeconds: 1,
    backoffMultiplier: 2,
} as const;

/**
 * Errors that mean "retrying right now will just fail again" - rate/quota limits need
 * time to recover, not more attempts. Retrying these blindly wastes the same exhausted
 * budget the error is complaining about and delays surfacing a clear failure.
 */
const NON_RETRYABLE_ERROR_NAMES = ['ThrottlingException', 'ServiceQuotaExceededException'];

/**
 * Standard retry strategy for steps and invocations
 * Retries up to 10 times with exponential backoff, except for throttling/quota errors,
 * which fail immediately since they won't resolve within this execution's lifetime.
 */
export function createRetryStrategy() {
    return (error: Error, attemptCount: number) => {
        if (NON_RETRYABLE_ERROR_NAMES.includes(error.name)) {
            return { shouldRetry: false };
        }

        if (attemptCount >= RETRY_CONFIG.maxAttempts) {
            return { shouldRetry: false };
        }

        const delaySeconds = RETRY_CONFIG.initialDelaySeconds * Math.pow(RETRY_CONFIG.backoffMultiplier, attemptCount - 1);

        return {
            shouldRetry: true,
            delay: { seconds: delaySeconds }
        };
    };
}
