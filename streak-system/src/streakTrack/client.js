import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import { SNSClient } from "@aws-sdk/client-sns";

const REGION= "ap-southeast-1";
export const ddbClient = new DynamoDBClient({ region: REGION });
export const snsClient = new SNSClient({ region: REGION });
