import '../shared/config';

import { type Handler } from 'aws-lambda';
import { wakeUp } from '../shared/engine/live';

export const handler: Handler = async () => {
  await wakeUp();
};
