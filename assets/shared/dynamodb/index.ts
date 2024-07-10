import {
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from './dynamodb';
import { TableName, MastodonDomain } from '../env/value';
import { MastodonApp, MastodonToken } from '../types';
import { ulid } from 'ulid';
import chunk from 'lodash/chunk';

function pad0(num: number | string, length: number): string {
  return num.toString().padStart(length, '0');
}

function appKey(): Record<string, any> {
  return {
    PK: `app#${MastodonDomain}`,
    SK: '#',
  };
}

function appTokenKey(): Record<string, any> {
  return {
    PK: `app#${MastodonDomain}#token`,
    SK: '#',
  };
}

function appSinceIdKey(): Record<string, any> {
  return {
    PK: `app#${MastodonDomain}#since_id`,
    SK: '#',
  };
}

function appTweetTopicKey(id: string): Record<string, any> {
  return {
    PK: appTweetTopicPK(),
    SK: `topic#${id}`,
  };
}

function appTweetTopicPK(): string {
  return `app#${MastodonDomain}#topic`;
}

function dailySloganKey(
  year: number,
  month: number,
  day: number,
): Record<string, any> {
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
  return res.Item ? (res.Item as MastodonApp) : undefined;
}

export async function saveApp(app: MastodonApp) {
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

  return res.Item ? (res.Item as MastodonToken) : null;
}

export async function saveApiToken(res: MastodonToken) {
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

export async function saveNotificationSinceId(sinceId: string) {
  await docClient.send(
    new PutCommand({
      TableName,
      Item: { ...appSinceIdKey(), since_id: sinceId },
    }),
  );
}

export async function saveRecentTweetTopic(topic: string, expireAt: number) {
  const id = ulid();
  await docClient.send(
    new PutCommand({
      TableName,
      Item: {
        ...appTweetTopicKey(id),
        topic,
        expireAt,
      },
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

  return res.Items.map((item) => item.topic as string);
}

export async function queryDailySlogan(
  year: number,
  month: number,
  day: number,
) {
  const res = await docClient.send(
    new GetCommand({
      TableName,
      Key: dailySloganKey(year, month, day),
    }),
  );

  if (!res.Item) return undefined;

  return res.Item.text as string | undefined;
}

const MaxBatchWriteItem = 25;

export async function saveDailySlogan(
  year: number,
  month: number,
  schedule: Record<string, string>,
  expireAt: number,
) {
  await Promise.all(
    chunk(Object.entries(schedule), MaxBatchWriteItem).map((schedules) =>
      docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [TableName]: schedules.map(([day, text]) => ({
              PutRequest: {
                Item: {
                  ...dailySloganKey(year, month, Number(day)),
                  text,
                  expireAt,
                },
              },
            })),
          },
        }),
      ),
    ),
  );
}

export async function queryHourlyTodo(
  year: number,
  month: number,
  day: number,
  hour: number,
) {
  const res = await docClient.send(
    new GetCommand({
      TableName,
      Key: hourlyTodoKey(year, month, day, hour),
    }),
  );

  if (!res.Item) return undefined;

  return res.Item.text as string | undefined;
}

export async function saveHourlyTodo(
  year: number,
  month: number,
  day: number,
  todos: Record<string, string>,
  expireAt: number,
) {
  await docClient.send(
    new BatchWriteCommand({
      RequestItems: {
        [TableName]: Object.entries(todos).map(([hour, text]) => ({
          PutRequest: {
            Item: {
              ...hourlyTodoKey(year, month, day, hour),
              text,
              expireAt,
            },
          },
        })),
      },
    }),
  );
}

export async function updateHourlyTodo(
  year: number,
  month: number,
  day: number,
  hour: number,
  text: string,
) {
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
