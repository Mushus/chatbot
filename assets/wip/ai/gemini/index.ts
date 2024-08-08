import {
  GenerateContentRequest,
  HarmBlockThreshold,
  HarmCategory,
  ModelParams,
} from '@google-cloud/vertexai/build/src/types/content';
import { VertexAI } from '@google-cloud/vertexai/build/src/vertex_ai';
import {
  Debug,
  GoogleCloudLocation,
  GoogleCloudProject,
} from '../../../core/env/value';
import { instance } from 'gaxios';
import { Content, User } from '../types';

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

export default async function generate(
  contents: Content[],
  persona: User,
  user: User,
): Promise<Omit<Content, 'datetime'> | undefined> {
  const model = 'gemini-1.5-flash-001';

  const systemInstruction = `"conversation log" から "core memory" に含まれていない未知の情報をすべて一覧化してください。

  **例**
  input: 2024/08/05(月) 20:36:47 ユーザー: 今日は晴れてたんだけど、夕方から雨が降り出したんだよね。
  output: ["2024/08/05はユーザーの住む地域では晴れだった", "2024/08/05はユーザーの住む地域では夕方から雨が降った"]

  **出力フォーマット**

  \`\`\`
  string[]
  \`\`\`
  `;
  // Instantiate the models
  const config = {
    maxOutputTokens: 8192,
    temperature: 1,
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
    systemInstruction,
  };

  // 2024/08/04(日) 17:58:12 餅月ルナ: むしゅさん、計算方法を教えてくれてありがとうね！ルーちゃも一巻読む時間を測ってみようかな！
  // 2024/08/04(日) 17:58:39 むしゅ: やろう
  // 2024/08/04(日) 17:58:41 餅月ルナ: むしゅさん、一緒に本を読む時間を測って計算してみようよ！
  // 2024/08/04(日) 17:59:23 むしゅ: 自分は1巻1時間位で読むよ。
  // 2024/08/04(日) 17:59:25 餅月ルナ: むしゅさん、1時間くらいで読めるんだ！すごい！ルーちゃはもっと時間かかるかな…🤔  一緒に測ってみよう！
  // 2024/08/05(月) 03:36:47 むしゅ: こんばんはなにの話ししてたっけ？

  const generativeModel = vertexAI.preview.getGenerativeModel(modelParams);

  const userNameTable = {
    agent: persona.name,
    user: user.name,
    system: 'system',
  } as const;

  const messages = contents
    .map(
      (content) =>
        `${content.datetime.format('YYYY/MM/DD(ddd) HH:mm:ss')} ${userNameTable[content.role]}: ${content.content}`,
    )
    .join('\n');

  const contentText = `personaCoreMemory(${persona.coreMemory.length}/200 characters):
\`\`\`
${persona.coreMemory}
\`\`\`

userCoreMemory(${user.coreMemory.length}/200 characters):
\`\`\`
${user.coreMemory}
\`\`\`

**conversation log**
${messages}
`;

  const req: GenerateContentRequest = {
    contents: [{ role: 'user', parts: [{ text: contentText }] }],
  };

  if (Debug)
    console.log('Generating message...', systemInstruction, contentText);
  const res = await generativeModel.generateContent(req);

  const outputContent = res.response.candidates?.map(
    (candidate) => candidate.content.parts[0]?.text ?? '',
  );

  if (!outputContent || outputContent.length < 1) return undefined;

  return {
    role: 'agent',
    content: outputContent.join('\n'),
  };
}
