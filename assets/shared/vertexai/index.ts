import {
  HarmBlockThreshold,
  HarmCategory,
  ModelParams,
} from '@google-cloud/vertexai/build/src/types/content';
import { VertexAI } from '@google-cloud/vertexai/build/src/vertex_ai';
import { instance } from 'gaxios';
import { GoogleCloudLocation, GoogleCloudProject } from '../env/value';

const vertexAI = new VertexAI({
  project: GoogleCloudProject,
  location: GoogleCloudLocation,
});

// for debug
instance.defaults.errorRedactor = (data) => {
  console.error('errorRedactor', data.config);
  console.error('errorRedactor', data.response?.data);
  return {};
};

export default async function generate(props: {
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
}) {
  const model = 'gemini-1.5-flash-001';

  console.log('Generating message...', props.systemInstruction, props.prompt);
  // Instantiate the models
  const config = {
    maxOutputTokens: 8192,
    temperature: props.temperature ?? 1,
    topP: 0.95,
    // response_mime_type 型上ないけど、設定としては有効なのでセットしたい
    response_mime_type: 'application/json',
  };

  const modelParams: ModelParams = {
    model: model,
    generationConfig: config,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
    ],
  };

  if (props.systemInstruction) {
    modelParams.systemInstruction = props.systemInstruction;
  }

  const generativeModel = vertexAI.preview.getGenerativeModel(modelParams);

  const req = {
    contents: [{ role: 'user', parts: [{ text: props.prompt }] }],
  };

  const streamingResp = await generativeModel.generateContentStream(req);

  const res = await streamingResp.response;
  console.log(JSON.stringify(res, null, 2));
  const message =
    res.candidates
      ?.flatMap((candidate) => candidate.content.parts.map((part) => part.text))
      .join('\n') ?? '';

  return JSON.parse(message) as unknown;
}
