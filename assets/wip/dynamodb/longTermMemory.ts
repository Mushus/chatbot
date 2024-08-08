import {
  QueryCommand,
  BatchWriteCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';
import { dynamoCli } from './dynamodb';
import { TableName } from '../../core/env/value';
import * as v from 'valibot';
import { ulid } from 'ulid';
import dayjs from 'dayjs';

const listCount = 5;

const LongTermMemoryKeywordSchema = v.object({
  PK: v.string(),
  SK: v.string(),
  id: v.string(),
});

const LongTermMemoryContentSchema = v.object({
  PK: v.string(),
  SK: v.string(),
  date: v.number(),
  content: v.string(),
});

export async function getLongTermMemory(keywords: string[]) {
  const ids: string[] = [];
  for (const keyword of keywords) {
    const rest = listCount - ids.length;
    const inExp = ids.map((_, i) => `:k${i}`).join(', ');
    const paramValues = Object.fromEntries(ids.map((v, i) => [`:k${i}`, v]));
    const res = await dynamoCli.send(
      new QueryCommand({
        TableName,
        KeyConditionExpression: 'PK = :pk and begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `longTermMemoryKeyword`,
          ':sk': `${keyword}#`,
          ...paramValues,
        },
        ...(ids.length > 0
          ? { FilterExpression: `content in (${inExp})` }
          : {}),
        Limit: rest,
      }),
    );

    if (!res.Items) continue;

    const items = res.Items.map(
      (item) => v.parse(LongTermMemoryKeywordSchema, item).id,
    );
    ids.push(...items.slice(0, rest));
  }

  if (ids.length === 0) return [];

  const res = await dynamoCli.send(
    new BatchGetCommand({
      RequestItems: {
        [TableName]: {
          Keys: ids.map((id) => ({
            PK: `longTermMemoryContent`,
            SK: id,
          })),
        },
      },
    }),
  );

  const items = res.Responses?.[TableName];
  if (!items) return [];

  return items.map(
    (record) => v.parse(LongTermMemoryContentSchema, record).content,
  );
}

export async function setLongTermMemory(
  now: dayjs.Dayjs,
  keywords: string[],
  content: string,
) {
  const id = ulid();

  await dynamoCli.send(
    new BatchWriteCommand({
      RequestItems: {
        [TableName]: [
          {
            PutRequest: {
              Item: {
                PK: `longTermMemoryContent`,
                SK: id,
                date: now.unix(),
                content,
              },
            },
          },
          ...keywords.map((keyword) => ({
            PutRequest: {
              Item: {
                PK: `longTermMemoryKeyword`,
                SK: `${keyword}#${id}`,
                id,
              },
            },
          })),
        ],
      },
    }),
  );
}
