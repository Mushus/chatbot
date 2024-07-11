import 'dotenv/config';
import { handler } from './index';
import { Context } from 'aws-lambda';

const context: Context = {
  awsRequestId: '123',
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'test',
  functionVersion: '1',
  invokedFunctionArn: 'arn',
  logGroupName: 'test',
  logStreamName: 'test',
  memoryLimitInMB: '128',
  done: () => {},
  fail: () => {},
  getRemainingTimeInMillis: () => 1000,
  succeed: () => {},
};

handler(null, context, () => {});
