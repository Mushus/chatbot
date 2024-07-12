import { ITableV2 } from 'aws-cdk-lib/aws-dynamodb';
import {
  EnvAppName,
  EnvGoogleApplicationCredentials,
  EnvGoogleCloudLocation,
  EnvGoogleCloudProject,
  EnvMastodonDomain,
  EnvTableSettings,
} from '../../assets/shared/env/key';
import { BundlingOptions } from 'aws-cdk-lib/aws-lambda-nodejs';

export function buildEnvironment(table: ITableV2) {
  const environment = {
    [EnvMastodonDomain]: 'm.mushus.net',
    [EnvTableSettings]: table.tableName,
    [EnvAppName]: 'tweeet',
    [EnvGoogleApplicationCredentials]: './clientLibraryConfig.json',
    [EnvGoogleCloudProject]: 'chatbot-428611',
    [EnvGoogleCloudLocation]: 'asia-northeast1',
  };

  return environment;
}

export const bundling: BundlingOptions = {
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
