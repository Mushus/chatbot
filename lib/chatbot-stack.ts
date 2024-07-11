import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { FunctionUrlAuthType, Runtime } from 'aws-cdk-lib/aws-lambda';
import { BundlingOptions, NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import path from 'path';
import {
  EnvAppName,
  EnvGoogleApplicationCredentials,
  EnvGoogleCloudLocation,
  EnvGoogleCloudProject,
  EnvMastodonDomain,
  EnvTableSettings,
} from '../assets/shared/env/key';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

const bundling: BundlingOptions = {
  esbuildArgs: {
    // '--main-fields': 'module,main',
    // '--minify': true,
    // '--keep-names': true,
  },
  commandHooks: {
    beforeInstall() {
      return [``];
    },
    beforeBundling() {
      return [``];
    },
    afterBundling(inputDir, outputDir) {
      return [`cp ${inputDir}/assets/clientLibraryConfig.json ${outputDir}`];
    },
  },
};

export class ChatbotStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    new Table(this, 'SettingsTable', {
      partitionKey: { name: 'ID', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expireAt',
    });

    const chatbotTbl = new Table(this, 'ChatbotTbl', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expireAt',
    });

    const logGroup = new LogGroup(this, 'ChatbotFunctionLogGroup', {
      logGroupName: `/aws/lambda/chatbot`,
      retention: RetentionDays.THREE_MONTHS,
    });

    const role = new Role(this, 'ChatbotFunctionRole', {
      roleName: 'Chatbot', // google: The size of mapped attribute google.subject exceeds the 127 bytes limit. Either modify your attribute mapping or the incoming assertion to produce a mapped attribute that is less than 127 bytes.
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole',
      ),
    );
    chatbotTbl.grantReadWriteData(role);

    const chatbotFunction = new NodejsFunction(this, 'ChatbotFunction', {
      entry: path.join(__dirname, '../assets/chatbot/index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      logGroup: logGroup,
      role,
      environment: {
        [EnvMastodonDomain]: 'm.mushus.net',
        [EnvTableSettings]: chatbotTbl.tableName,
        [EnvAppName]: 'tweeet',
        [EnvGoogleApplicationCredentials]: './clientLibraryConfig.json',
        [EnvGoogleCloudProject]: 'chatbot-428611',
        [EnvGoogleCloudLocation]: 'asia-northeast1',
      },
      timeout: Duration.minutes(1),
      bundling,
    });
    chatbotFunction.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    });

    const batchLog = new LogGroup(this, 'BatchLogGroup', {
      logGroupName: `/aws/lambda/chatbot/batch`,
      retention: RetentionDays.THREE_MONTHS,
    });

    const batchStateFn = new NodejsFunction(this, 'BatchStateFn', {
      entry: path.join(__dirname, '../assets/batch/index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      logGroup: batchLog,
      role,
      environment: {
        [EnvMastodonDomain]: 'm.mushus.net',
        [EnvTableSettings]: chatbotTbl.tableName,
        [EnvAppName]: 'chatbot',
        [EnvGoogleApplicationCredentials]: './clientLibraryConfig.json',
        [EnvGoogleCloudProject]: 'chatbot-428611',
        [EnvGoogleCloudLocation]: 'asia-northeast1',
      },
      timeout: Duration.minutes(1),
      bundling,
    });

    const cron = new Rule(this, 'BatchRule', {
      schedule: Schedule.cron({ minute: '*/10', hour: '23-14' }), // UTC
    });
    cron.addTarget(new LambdaFunction(batchStateFn));
  }
}
