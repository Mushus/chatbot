import '../core/config';

import { type Handler } from 'aws-lambda';
import { wakeUp } from '../core/engine/live';

export const handler: Handler = async () => {
  await wakeUp();
};
