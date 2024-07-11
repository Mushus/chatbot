import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import * as v from 'valibot';
import { MastodonDomain, TableName } from '../env/value';
import { docClient } from './dynamodb';

function appTweetTopicPK(): string {
  return `app#${MastodonDomain}#topic`;
}

function appTweetTopicKey(id: string) {
  return {
    PK: appTweetTopicPK(),
    SK: `topic#${id}`,
  };
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
