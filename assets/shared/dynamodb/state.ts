import { MastodonDomain, TableName } from '../env/value';
import dayjs from 'dayjs';
import { docClient } from './dynamodb';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import * as v from 'valibot';
import { TimestampUTC } from '../const';

const StateSchema = v.object({
  PK: v.string(),
  SK: v.string(),
  location: v.optional(v.string()),
  situation: v.optional(v.string()),
  thinking: v.optional(v.string()),
  action: v.optional(v.string()),
  expireAt: v.number(),
});

type State = v.InferInput<typeof StateSchema>;

function key(dayjs: dayjs.Dayjs) {
  return {
    PK: PK,
    SK: dayjs.utc().format(TimestampUTC),
  };
}

const PK = `app#${MastodonDomain}#state`;

export async function queryStateHistory(props: { limit: number }) {
  const command = new QueryCommand({
    TableName,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: {
      '#pk': 'PK',
    },
    ExpressionAttributeValues: {
      ':pk': PK,
    },
    ScanIndexForward: false,
    Limit: props.limit,
  });
  const res = await docClient.send(command);

  const items = res.Items;
  if (!items) return [];

  return items
    .map((item) => v.parse(StateSchema, item))
    .map((item) => ({
      time: dayjs.tz(item.SK, TimestampUTC, 'UTC'),
      location: item.location,
      situation: item.situation,
      thinking: item.thinking,
      action: item.action,
    }));
}

export async function saveState(
  time: dayjs.Dayjs,
  location: string,
  situation: string,
  thinking: string,
  action: string,
) {
  const item: State = {
    ...key(time),
    location,
    situation,
    thinking,
    action,
    expireAt: time.add(1, 'day').unix(),
  };

  const command = new PutCommand({
    TableName,
    Item: item,
  });

  await docClient.send(command);
}
