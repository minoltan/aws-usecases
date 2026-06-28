import { BedrockAgentRuntimeClient } from "@aws-sdk/client-bedrock-agent-runtime";

const REGION = "us-east-1";
export const bedrockAgentRuntimeClient = new BedrockAgentRuntimeClient({ region: REGION });
