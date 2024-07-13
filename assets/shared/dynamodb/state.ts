import { MastodonDomain, TableName } from '../env/value';
import dayjs from 'dayjs';
import { docClient } from './dynamodb';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import * as v from 'valibot';
import { TimestampUTC } from '../const';

const StateSchema = v.object({
  PK: v.string(),
  SK: v.string(),
  location: v.string(),
  situation: v.string(),
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

export async function findLatestState() {
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
    Limit: 1,
  });
  const res = await docClient.send(command);

  const item = res.Items?.[0];
  if (!item) return undefined;

  return v.parse(StateSchema, item);
}

export async function saveState(
  time: dayjs.Dayjs,
  location: string,
  situation: string,
) {
  const item: State = {
    ...key(time),
    location,
    situation,
    expireAt: time.add(1, 'day').unix(),
  };

  const command = new PutCommand({
    TableName,
    Item: item,
  });

  await docClient.send(command);
}
