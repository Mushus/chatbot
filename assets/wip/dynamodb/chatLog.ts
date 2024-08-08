import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoCli } from './dynamodb';
import { TableName } from '../../core/env/value';
import * as v from 'valibot';
import dayjs from 'dayjs';
import { ulid } from 'ulid';

const ChatLogSchema = v.object({
  PK: v.string(),
  SK: v.string(),
  user: v.string(),
  content: v.string(),
  datetime: v.number(),
  expireAt: v.number(),
});

export async function getChatLogs() {
  const res = await dynamoCli.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'chatLog',
      },
      Limit: 5,
      ScanIndexForward: false,
    }),
  );

  if (!res.Items) return [];
  return res.Items.map((item) => {
    const record = v.parse(ChatLogSchema, item);
    return {
      user: record.user,
      content: record.content,
      datetime: dayjs.unix(record.datetime),
    };
  }).reverse();
}

export async function appendChatLogs(
  now: dayjs.Dayjs,
  user: string,
  content: string,
) {
  const SK = ulid();
  await dynamoCli.send(
    new PutCommand({
      TableName,
      Item: {
        PK: 'chatLog',
        SK,
        user,
        content,
        datetime: now.unix(),
        expireAt: now.add(1, 'day').unix(),
      },
    }),
  );
}
