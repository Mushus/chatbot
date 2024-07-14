import { Token } from 'aws-cdk-lib';
import { MastodonCredentials } from '../types';
import { generateAction } from './generator';
import { queryStateHistory, saveState } from '../dynamodb/state';
import dayjs from 'dayjs';

const DefaultLocation = '自分の家の中';
const DefaultSituation = '目がさめた';

export async function wakeUp() {
  const time = dayjs();
  const location = DefaultLocation;
  const situation = DefaultSituation;

  await saveState(time, location, situation, '', '');
}

export async function live(_token: Token, _cred: MastodonCredentials) {
  const stateHistoryData = await queryStateHistory({ limit: 10 });
  const time = dayjs();

  const stateHistory = stateHistoryData.map((state) => ({
    time: state.time,
    location: state.location ?? DefaultLocation,
    situation: state.situation ?? DefaultSituation,
  }));

  const action = await generateAction({ time, stateHistory });
  await saveState(
    time,
    action.nextLocation,
    action.nextSituation,
    action.thinking,
    action.action,
  );
}
