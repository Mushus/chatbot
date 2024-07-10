import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const client = new DynamoDB({});
export const docClient = DynamoDBDocumentClient.from(client);
