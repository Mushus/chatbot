import '../core/config';

import { type Handler } from 'aws-lambda';
import { batch } from '../core/engine/batch';

export const handler: Handler = async () => {
  await batch();
};
