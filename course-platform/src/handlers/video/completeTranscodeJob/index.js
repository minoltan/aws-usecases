import { SFNClient, SendTaskSuccessCommand } from "@aws-sdk/client-sfn";

const sfnClient = new SFNClient({});

// Triggered by MediaConvert's "Job State Change" event on the AWS default event bus.
// Always resolves the task token with SendTaskSuccess (carrying a status field) rather
// than SendTaskFailure, so the state machine's own Choice state -- not an opaque Step
// Functions Catch -- decides the READY/FAILED branch with full context (videoId etc).
export const handler = async (event) => {
    const detail = event.detail;
    const userMetadata = detail.userMetadata ?? {};
    const { taskToken, videoId, pk, sk } = userMetadata;

    if (!taskToken) {
        console.warn({ level: "WARN", message: "MediaConvert event missing taskToken", detail });
        return;
    }

    const isComplete = detail.status === "COMPLETE";
    const outputFilePath = detail.outputGroupDetails?.[0]?.outputDetails?.[0]?.outputFilePaths?.[0];
    const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN;
    const cloudFrontUrl = isComplete && outputFilePath && cloudFrontDomain
        ? `https://${cloudFrontDomain}/${outputFilePath.split("/").slice(3).join("/")}`
        : null;

    await sfnClient.send(new SendTaskSuccessCommand({
        taskToken,
        output: JSON.stringify({
            videoId,
            pk,
            sk,
            status: isComplete ? "READY" : "FAILED",
            cloudFrontUrl,
        }),
    }));
};
