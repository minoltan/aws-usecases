import { StartIngestionJobCommand } from "@aws-sdk/client-bedrock-agent";
import { bedrockAgentClient } from "./bedrockAgentClient.js";

export const handler = async (event) => {
    try {
        await startIngestionJob();
    } catch (error) {
        if (error.name === 'ConflictException') {
            // A job is already running for this data source. It scans the whole S3 prefix on
            // each run, so the recipe that triggered this event will be picked up by it too.
            console.warn({ level: 'WARN', message: 'Ingestion job already in progress, skipping', error: error.message });
            return;
        }
        console.error({ level: 'ERROR', message: 'Handler error', error });
        throw error;
    }
};

async function startIngestionJob() {
    const command = new StartIngestionJobCommand({
        knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
        dataSourceId: process.env.DATA_SOURCE_ID
    });

    await bedrockAgentClient.send(command);
}
