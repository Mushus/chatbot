import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { MastodonDomain, TableName } from '../env/value';
import { docClient } from './dynamodb';

function appTimelineSinceIdKey(): Record<string, any> {
  return {
    PK: `app#${MastodonDomain}#timeline_since_id`,
    SK: '#',
  };
}

export async function findAppTimelineSinceId(): Promise<string> {
  const res = await docClient.send(
    new GetCommand({ TableName, Key: appTimelineSinceIdKey() }),
  );
  return res.Item?.sinceId;
}

export async function saveAppTimelineSinceId(sinceId: string) {
  await docClient.send(
    new PutCommand({
      TableName,
      Item: { ...appTimelineSinceIdKey(), sinceId },
    }),
  );
}
