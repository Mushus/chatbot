import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { MastodonDomain, TableName } from '../env/value';
import { docClient } from './dynamodb';

function appSinceIdKey() {
  return {
    PK: `app#${MastodonDomain}#since_id`,
    SK: '#',
  };
}

export async function findNotificationSinceId(): Promise<string | undefined> {
  const res = await docClient.send(
    new GetCommand({
      TableName,
      Key: appSinceIdKey(),
    }),
  );

  return res.Item?.since_id;
}

export async function saveNotificationSinceId(sinceId: string): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName,
      Item: { ...appSinceIdKey(), since_id: sinceId },
    }),
  );
}
