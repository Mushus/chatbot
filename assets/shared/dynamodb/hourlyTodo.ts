import {
  BatchWriteCommand,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import * as v from 'valibot';
import { MastodonDomain, TableName } from '../env/value';
import { pad0 } from '../util';
import { docClient } from './dynamodb';

function hourlyTodoKey(
  year: number,
  month: number,
  day: number,
  hour: number | string,
) {
  return {
    PK: `app#${MastodonDomain}#todo`,
    SK: `${year}/${pad0(month, 2)}/${pad0(day, 2)}#${pad0(hour, 2)}`,
  };
}

const HourlyTodoSchema = v.object({
  PK: v.string(),
  SK: v.string(),
  text: v.string(),
  expireAt: v.number(),
});

export async function queryHourlyTodo(
  year: number,
  month: number,
  day: number,
  hour: number,
): Promise<string | undefined> {
  const res = await docClient.send(
    new GetCommand({
      TableName,
      Key: hourlyTodoKey(year, month, day, hour),
    }),
  );

  if (!res.Item) return undefined;

  const todo = v.parse(HourlyTodoSchema, res.Item);
  return todo.text;
}

export async function saveHourlyTodo(
  year: number,
  month: number,
  day: number,
  todoTable: Record<string, string>,
  expireAt: number,
): Promise<void> {
  const items = Object.entries(todoTable).map(([hour, text]) => ({
    ...hourlyTodoKey(year, month, day, Number(hour)),
    text,
    expireAt,
  }));

  const writeRequests = items.map((item) => ({
    PutRequest: { Item: item },
  }));

  const command = new BatchWriteCommand({
    RequestItems: {
      [TableName]: writeRequests,
    },
  });

  await docClient.send(command);
}

export async function updateHourlyTodo(
  year: number,
  month: number,
  day: number,
  hour: number,
  text: string,
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName,
      Item: {
        ...hourlyTodoKey(year, month, day, hour),
        text,
      },
    }),
  );
}
