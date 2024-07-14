import { BundlingOptions } from 'aws-cdk-lib/aws-lambda-nodejs';

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
