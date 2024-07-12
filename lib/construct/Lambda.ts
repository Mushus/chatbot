import { Duration } from 'aws-cdk-lib';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { bundling } from './shared';

export type Props = {
  logName: string;
  entry: string;
  role: Role;
  timeout?: Duration | undefined;
  environment: Record<string, string>;
};

export default class Lambda extends Construct {
  public readonly fn: NodejsFunction;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { logName, entry, role, timeout, environment } = props;

    const logGroup = new LogGroup(this, 'Log', {
      logGroupName: `/aws/lambda/chatbot/${logName}`,
      retention: RetentionDays.THREE_MONTHS,
    });

    const fn = new NodejsFunction(this, 'Default', {
      entry,
      runtime: Runtime.NODEJS_20_X,
      logGroup,
      role,
      environment,
      timeout,
      bundling,
    });

    this.fn = fn;
  }
}
