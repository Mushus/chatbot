import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { MastodonDomain, TableName } from '../env/value';
import { docClient } from './dynamodb';
import * as v from 'valibot';

function appSinceIdKey() {
  return {
    PK: `app#${MastodonDomain}#since_id`,
    SK: '#',
  };
}

const ItemSchema = v.object({
  PK: v.string(),
  SK: v.string(),
  sinceId: v.string(),
});

type Item = v.InferInput<typeof ItemSchema>;

export async function findNotificationSinceId(): Promise<string | undefined> {
  const res = await docClient.send(
    new GetCommand({
      TableName,
      Key: appSinceIdKey(),
    }),
  );

  if (!res.Item) return undefined;
  const item = v.parse(ItemSchema, res.Item);
  return item.sinceId;
}

export async function saveNotificationSinceId(sinceId: string): Promise<void> {
  const item: Item = { ...appSinceIdKey(), sinceId };
  await docClient.send(
    new PutCommand({
      TableName,
      Item: item,
    }),
  );
}
