import {
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from './dynamodb';
import { TableName, MastodonDomain } from '../env/value';
import {
  MastodonApp,
  MastodonAppSchema,
  MastodonToken,
  MastodonTokenSchema,
} from '../types';
import { ulid } from 'ulid';
import chunk from 'lodash/chunk';
import * as v from 'valibot';

function pad0(num: number | string, length: number): string {
  return num.toString().padStart(length, '0');
}

function appKey() {
  return {
    PK: `app#${MastodonDomain}`,
    SK: '#',
  };
}

function appTokenKey() {
  return {
    PK: `app#${MastodonDomain}#token`,
    SK: '#',
  };
}

function appSinceIdKey() {
  return {
    PK: `app#${MastodonDomain}#since_id`,
    SK: '#',
  };
}

function appTweetTopicKey(id: string) {
  return {
    PK: appTweetTopicPK(),
    SK: `topic#${id}`,
  };
}

function appTweetTopicPK(): string {
  return `app#${MastodonDomain}#topic`;
}

function dailySloganKey(year: number, month: number, day: number) {
  return {
    PK: dailySloganPK,
    SK: dailySloganSK(year, month, day),
  };
}

const dailySloganPK = `app#${MastodonDomain}#slogan`;

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

function dailySloganSK(year: number, month: number, day: number): string {
  return `${year}/${pad0(month, 2)}/${pad0(day, 2)}`;
}

export async function findApp(): Promise<MastodonApp | undefined> {
  const res = await docClient.send(
    new GetCommand({ TableName, Key: appKey() }),
  );

  if (!res.Item) return undefined;
  const app = v.parse(MastodonAppSchema, res.Item);
  return app;
}

export async function saveApp(app: MastodonApp): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName,
      ConditionExpression:
        'attribute_not_exists(#pk) and attribute_not_exists(#sk)',
      ExpressionAttributeNames: {
        '#pk': 'PK',
        '#sk': 'SK',
      },
      Item: { ...appKey(), ...app },
    }),
  );
}

export async function findAppToken(): Promise<MastodonToken | null> {
  const res = await docClient.send(
    new GetCommand({ TableName, Key: appTokenKey() }),
  );

  if (!res.Item) return null;
  const appToken = v.parse(MastodonTokenSchema, res.Item);
  return appToken;
}

export async function saveApiToken(res: MastodonToken): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName,
      ConditionExpression:
        'attribute_not_exists(#pk) and attribute_not_exists(#sk)',
      ExpressionAttributeNames: {
        '#pk': 'PK',
        '#sk': 'SK',
      },
      Item: { ...appTokenKey(), ...res },
    }),
  );
}

export async function findNotificationSinceId(): Promise<string | undefined> {
  const res = await docClient.send(
    new GetCommand({
      TableName,
      Key: appSinceIdKey(),
    }),
  );

  return res.Item?.since_id;
}

export async function saveNotificationSinceId(sinceId: string): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName,
      Item: { ...appSinceIdKey(), since_id: sinceId },
    }),
  );
}

const RecentTweetTopicSchema = v.object({
  PK: v.string(),
  SK: v.string(),
  text: v.string(),
  expireAt: v.number(),
});

type RecentTweetTopic = v.InferInput<typeof RecentTweetTopicSchema>;

export async function saveRecentTweetTopic(
  topic: string,
  expireAt: number,
): Promise<void> {
  const id = ulid();

  const item: RecentTweetTopic = {
    ...appTweetTopicKey(id),
    text: topic,
    expireAt,
  };

  await docClient.send(
    new PutCommand({
      TableName,
      Item: item,
    }),
  );
}

export async function queryRecentTweetTopics(limit: number): Promise<string[]> {
  const res = await docClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: {
        '#pk': 'PK',
      },
      ExpressionAttributeValues: {
        ':pk': appTweetTopicPK(),
      },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );

  if (!res.Items) return [];

  return res.Items.map((item) => v.parse(RecentTweetTopicSchema, item).text);
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
