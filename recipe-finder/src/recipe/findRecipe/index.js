import { RetrieveAndGenerateCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { bedrockAgentRuntimeClient } from "./bedrockAgentRuntimeClient.js";

export const handler = async (event) => {
    try {
        const payload = JSON.parse(event.body);

        const result = await findRecipe(payload.query);

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(result),
        };

    } catch (error) {
        console.error({ level: 'ERROR', message: 'Handler error', error });
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: error.message }),
        };
    }
};

async function findRecipe(query) {
    const command = new RetrieveAndGenerateCommand({
        input: { text: query },
        retrieveAndGenerateConfiguration: {
            type: 'KNOWLEDGE_BASE',
            knowledgeBaseConfiguration: {
                knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
                modelArn: process.env.GENERATION_MODEL_ARN
            }
        }
    });

    const response = await bedrockAgentRuntimeClient.send(command);

    return {
        answer: response.output?.text,
        sources: (response.citations ?? [])
            .flatMap(citation => citation.retrievedReferences ?? [])
            .map(reference => reference.location?.s3Location?.uri)
            .filter(Boolean)
    };
}
