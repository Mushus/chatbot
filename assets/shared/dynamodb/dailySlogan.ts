import { BatchWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { chunk } from 'es-toolkit/array';
import * as v from 'valibot';
import { MastodonDomain, TableName } from '../env/value';
import { pad0 } from '../util';
import { docClient } from './dynamodb';

function dailySloganKey(year: number, month: number, day: number) {
  return {
    PK: dailySloganPK,
    SK: dailySloganSK(year, month, day),
  };
}

const dailySloganPK = `app#${MastodonDomain}#slogan`;

function dailySloganSK(year: number, month: number, day: number): string {
  return `${year}/${pad0(month, 2)}/${pad0(day, 2)}`;
}

const DailySloganSchema = v.object({
  PK: v.string(),
  SK: v.string(),
  text: v.string(),
  expireAt: v.number(),
});

export async function queryDailySlogan(
  year: number,
  month: number,
  day: number,
): Promise<string | undefined> {
  const res = await docClient.send(
    new GetCommand({
      TableName,
      Key: dailySloganKey(year, month, day),
    }),
  );

  if (!res.Item) return undefined;

  const slogan = v.parse(DailySloganSchema, res.Item);
  return slogan.text;
}

const MaxBatchWriteItem = 25;

export async function saveDailySlogan(
  year: number,
  month: number,
  schedule: Record<string, string>,
  expireAt: number,
): Promise<void> {
  const items = Object.entries(schedule).map(([day, text]) => ({
    ...dailySloganKey(year, month, Number(day)),
    text,
    expireAt,
  }));

  const writeRequests = items.map((item) => ({
    PutRequest: { Item: item },
  }));

  const processes = chunk(writeRequests, MaxBatchWriteItem).map((requests) => {
    const command = new BatchWriteCommand({
      RequestItems: {
        [TableName]: requests,
      },
    });

    return docClient.send(command);
  });

  await Promise.all(processes);
}
