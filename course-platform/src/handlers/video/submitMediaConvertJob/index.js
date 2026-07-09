import { MediaConvertClient, DescribeEndpointsCommand, CreateJobCommand } from "@aws-sdk/client-mediaconvert";

// Step Functions task-token step: kicks off a MediaConvert job and returns immediately.
// The state machine stays paused until completeTranscodeJob (triggered by MediaConvert's
// own "Job State Change" event) calls SendTaskSuccess with the outcome.
export const handler = async (event) => {
    const { taskToken, bucket, key } = event;
    const videoId = key.split("/")[1];
    const pk = `VIDEO#${videoId}`;
    const sk = "META";

    const discoveryClient = new MediaConvertClient({});
    const endpoints = await discoveryClient.send(new DescribeEndpointsCommand({}));
    const endpointUrl = endpoints.Endpoints?.[0]?.Url;
    const mediaConvertClient = new MediaConvertClient({ endpoint: endpointUrl });

    await mediaConvertClient.send(new CreateJobCommand({
        Role: process.env.MEDIACONVERT_ROLE_ARN,
        UserMetadata: { taskToken, videoId, pk, sk },
        Settings: {
            Inputs: [{ FileInput: `s3://${bucket}/${key}` }],
            OutputGroups: [{
                Name: "File Group",
                OutputGroupSettings: {
                    Type: "FILE_GROUP_SETTINGS",
                    FileGroupSettings: { Destination: `s3://${process.env.OUTPUT_BUCKET_NAME}/${videoId}/` },
                },
                Outputs: [{
                    ContainerSettings: { Container: "MP4" },
                    VideoDescription: {
                        CodecSettings: {
                            Codec: "H_264",
                            H264Settings: { RateControlMode: "QVBR", MaxBitrate: 5000000 },
                        },
                    },
                    AudioDescriptions: [{
                        CodecSettings: {
                            Codec: "AAC",
                            AacSettings: { Bitrate: 96000, CodingMode: "CODING_MODE_2_0", SampleRate: 48000 },
                        },
                    }],
                }],
            }],
        },
    }));

    return { videoId };
};
