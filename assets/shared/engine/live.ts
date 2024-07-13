import { Token } from 'aws-cdk-lib';
import { MastodonCredentials } from '../types';
import { generateAction } from './generator';
import { findLatestState, saveState } from '../dynamodb/state';
import dayjs from 'dayjs';

const DefaultLocation = '自分の家の中';
const DefaultSituation = '目がさめた';

export async function wakeUp() {
  const time = dayjs();
  const location = DefaultLocation;
  const situation = DefaultSituation;

  await saveState(time, location, situation);
}

export async function live(_token: Token, _cred: MastodonCredentials) {
  const latestState = await findLatestState();
  const time = dayjs();
  const location = latestState?.location ?? DefaultLocation;
  const situation = latestState?.situation ?? DefaultSituation;

  const action = await generateAction({ time, location, situation });
  await saveState(time, action.nextLocation, action.nextSituation);
}
