import { type Handler } from 'aws-lambda';
import { batch } from '../shared/engine';

export const handler: Handler = async () => {
  await batch();
};
