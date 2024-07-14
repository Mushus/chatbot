import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { MastodonDomain, TableName } from '../env/value';
import { docClient } from './dynamodb';
import * as v from 'valibot';

function appTimelineSinceIdKey() {
  return {
    PK: `app#${MastodonDomain}#timeline_since_id`,
    SK: '#',
  };
}

const ItemSchema = v.object({
  PK: v.string(),
  SK: v.string(),
  sinceId: v.string(),
});

type Item = v.InferInput<typeof ItemSchema>;

export async function findAppTimelineSinceId() {
  const res = await docClient.send(
    new GetCommand({ TableName, Key: appTimelineSinceIdKey() }),
  );

  if (!res.Item) return undefined;
  const item = v.parse(ItemSchema, res.Item);
  return item.sinceId;
}

export async function saveAppTimelineSinceId(sinceId: string) {
  const item: Item = { ...appTimelineSinceIdKey(), sinceId };
  await docClient.send(
    new PutCommand({
      TableName,
      Item: item,
    }),
  );
}
