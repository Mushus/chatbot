import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as v from 'valibot';
import { MastodonDomain, TableName } from '../env/value';
import { MastodonApp, MastodonAppSchema } from '../types';
import { docClient } from './dynamodb';

function appKey() {
  return {
    PK: `app#${MastodonDomain}`,
    SK: '#',
  };
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
