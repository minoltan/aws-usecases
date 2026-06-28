import { BedrockAgentClient } from "@aws-sdk/client-bedrock-agent";

const REGION = "us-east-1";
export const bedrockAgentClient = new BedrockAgentClient({ region: REGION });
