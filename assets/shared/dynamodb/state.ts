import { MastodonDomain, TableName } from '../env/value';
import dayjs from 'dayjs';
import { docClient } from './dynamodb';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import * as v from 'valibot';

const StateSchema = v.object({
  PK: v.string(),
  SK: v.string(),
  location: v.string(),
  situation: v.string(),
});

function key(dayjs: dayjs.Dayjs) {
  return {
    PK: PK,
    SK: dayjs.utc().unix().toString(),
  };
}

const PK = `app#${MastodonDomain}#state`;

export async function findLatestState() {
  const command = new QueryCommand({
    TableName,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': { S: PK },
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
  const item = {
    ...key(time),
    location,
    situation,
  };

  const command = new PutCommand({
    TableName,
    Item: item,
  });

  await docClient.send(command);
}
