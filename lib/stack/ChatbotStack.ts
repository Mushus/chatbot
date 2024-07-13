import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import path from 'path';
import {
  EnvAppName,
  EnvGoogleApplicationCredentials,
  EnvGoogleCloudLocation,
  EnvGoogleCloudProject,
  EnvMastodonDomain,
  EnvTableSettings,
} from '../../assets/shared/env/key';
import Lambda from '../construct/Lambda';

dayjs.extend(utc);
dayjs.extend(timezone);

const WakeUpTime = dayjs.tz('0000-00-00 08:00:00', 'Asia/Tokyo').utc();
const ShutdownTime = dayjs.tz('0000-00-00 01:00:00', 'Asia/Tokyo').utc();

export class ChatbotStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const chatbotTbl = new TableV2(this, 'ChatbotData', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      timeToLiveAttribute: 'expireAt',
    });

    const environment = {
      [EnvMastodonDomain]: 'm.mushus.net',
      [EnvTableSettings]: chatbotTbl.tableName,
      [EnvAppName]: 'tweeet',
      [EnvGoogleApplicationCredentials]: './clientLibraryConfig.json',
      [EnvGoogleCloudProject]: 'chatbot-428611',
      [EnvGoogleCloudLocation]: 'asia-northeast1',
    };

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

    const webUI = new Lambda(this, 'WebUI', {
      logName: 'web-ui',
      entry: path.join(__dirname, '../../assets/web-ui/index.ts'),
      role,
      timeout: Duration.seconds(10),
      environment,
    });
    webUI.fn.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    });

    const wakeUp = new Lambda(this, 'WakeUp', {
      logName: 'wake-up',
      entry: path.join(__dirname, '../../assets/wake-up/index.ts'),
      role,
      timeout: Duration.minutes(10),
      environment,
    });
    const WakeUpBatchTime = WakeUpTime.add(-10, 'minute');
    console.log(WakeUpBatchTime.toString());
    const wakeUpRule = new Rule(this, 'WakeUpRule', {
      schedule: Schedule.cron({
        minute: WakeUpBatchTime.minute().toString(),
        hour: WakeUpBatchTime.hour().toString(),
      }),
    });
    wakeUpRule.addTarget(new LambdaFunction(wakeUp.fn));

    const batch = new Lambda(this, 'Batch', {
      logName: 'batch',
      entry: path.join(__dirname, '../../assets/batch/index.ts'),
      role,
      timeout: Duration.minutes(3),
      environment,
    });
    const cron = new Rule(this, 'BatchRule', {
      schedule: Schedule.cron({
        minute: '*/10',
        hour: `${WakeUpTime.hour()}-${ShutdownTime.hour()}`,
      }),
    });
    cron.addTarget(new LambdaFunction(batch.fn));
  }
}
