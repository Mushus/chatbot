import '../shared/config';

import { type Handler } from 'aws-lambda';
import { batch } from '../shared/engine/batch';

export const handler: Handler = async () => {
  await batch();
};
