import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as v from 'valibot';
import { TableName } from '../../core/env/value';
import { dynamoCli } from './dynamodb';
import { AttributeAction } from '@aws-sdk/client-dynamodb';

const CoreMemorySchema = v.object({
  PK: v.string(),
  SK: v.string(),
  content: v.string(),
  count: v.number(),
});

const PKValue = 'coreMemory';

export function parseCoreMemory<T>(item: unknown, defaultValue: T) {
  try {
    return v.parse(CoreMemorySchema, item);
  } catch (_) {
    return defaultValue;
  }
}

export async function coreMemoryGet(name: string) {
  const res = await dynamoCli.send(
    new GetCommand({
      TableName,
      Key: { PK: PKValue, SK: name },
    }),
  );

  const item = parseCoreMemory(res.Item, {
    content: '',
  });

  return item.content;
}

export async function coreMemorySet(name: string, content: string) {
  await dynamoCli.send(
    new UpdateCommand({
      TableName,
      Key: { PK: PKValue, SK: name },
      AttributeUpdates: {
        content: {
          Action: AttributeAction.PUT,
          Value: content,
        },
        count: {
          Action: AttributeAction.ADD,
          Value: 1,
        },
      },
    }),
  );
}

export async function coreMemoryList() {
  const res = await dynamoCli.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': PKValue,
      },
    }),
  );

  if (!res.Items) return [];

  return res.Items.map((item) => {
    const record = v.parse(CoreMemorySchema, item);
    return {
      name: record.SK,
      content: record.content,
      count: record.count,
    };
  });
}
