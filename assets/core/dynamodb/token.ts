import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as v from 'valibot';
import { MastodonDomain, TableName } from '../env/value';
import { MastodonToken, MastodonTokenSchema } from '../types';
import { docClient } from './dynamodb';

function appTokenKey() {
  return {
    PK: `app#${MastodonDomain}#token`,
    SK: '#',
  };
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
  const item: MastodonToken & { PK: string; SK: string } = {
    ...res,
    ...appTokenKey(),
  };

  await docClient.send(
    new PutCommand({
      TableName,
      ConditionExpression:
        'attribute_not_exists(#pk) and attribute_not_exists(#sk)',
      ExpressionAttributeNames: {
        '#pk': 'PK',
        '#sk': 'SK',
      },
      Item: item,
    }),
  );
}
