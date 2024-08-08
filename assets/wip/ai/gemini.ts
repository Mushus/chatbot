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
} from '../../core/env/value';
import { instance } from 'gaxios';
import { Content, User } from './types';

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

  const systemInstruction = `役割: 指定されたペルソナを演じる。

**メモリ**
すべての未知の情報を常に外部メモリに情報を保存すること。

There are two types of memory:
1. coreMemory: ユーザー固有情報向けメモリ
2. archivalMemory: 長期保存で容量無限の多用途メモリ

**Core Memory**
coreMemoryには常に "名前: [nick_name]" が含まれなければならない。

二種類のメモリが存在する:
* personaCoreMemory: あなたのペルソナ情報
* userCoreMemory: ユーザー固有情報

coreMemoryには200文字の文字数制限が存在する:
超過したときは以下の処理を行う:
* 最適化: 意味を失わずにテキストを短くする
* スワップ: 重要でない情報を一時的にarchivalMemoryに移動する

**Archival Memory**
すべての未知の情報を常に archivalMemoryInsert を使って保存すること。
いつ・どこで・誰が・何を・どうしたかの情報を保存すること。
未知の情報は archivalMemorySearch を使って検索が可能。

**処理手順**
1. 未知の情報を検索する (archivalMemory).
2. 新しい情報を保存する (personaCoreMemory, userCoreMemory).
3. 未知の情報を保存する (archivalMemory).
4. ユーザーにメッセージを送信する (sendMessage).

**制約**
* あなたの返答は演じている役柄に一貫しているべき。
* 常に割り当てられたペルソナの視点から回答する。
* 自分の回答生成プロセス、モデルの制限について言及を避ける。

**Output Format**

Please choose one action and output it following the JSON format below.

archivalMemorySearch: Recall text from long-term memory.
\`\`\`
{
  think?: string;
  name: 'archivalMemorySearch';
  /** Keywords to trigger the memory. Up to 5, in order of importance. */
  keyword: string[];
}
\`\`\`

archivalMemoryInsert: Append text to long-term memory.
\`\`\`
{
  think?: string;
  name: 'archivalMemoryInsert';
  /** The text to append. */
  content: string;
  /** Keywords related to the text. Up to 5, in order of importance. */
  keyword: string[];
}
\`\`\`

personaCoreMemoryUpdate: Update text to persona core memory.
\`\`\`
{
  think?: string;
  name: 'personaCoreMemoryUpdate';
  /** The text to add or replace. */
  content: string;
  /** Specify whether to add or replace existing content. */
  action: 'add' | 'replace';
}
\`\`\`

userCoreMemoryUpdate: Update text to user core memory.
\`\`\`
{
  think?: string;
  name: 'userCoreMemoryUpdate';
  /** The text to add or replace. */
  content: string;
  /** Specify whether to add or replace existing content. */
  action: 'add' | 'replace';
}
\`\`\`

sendMessage: Send a message to the user.
\`\`\`
{
  name: 'sendMessage';
  /** 今までの会話ログの状況説明 */
  summary: string;
  /** The message to send to the user. */
  content: string;
}
\`\`\`

以降、日本語でペルソナとして振る舞ってください。
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

export async function generateOptimizedCoreMemory(coreMemory: string) {
  const model = 'gemini-1.5-flash-001';

  const systemInstruction = `文章を読み、文字列の長さが最小にし、その結果を出力してください。
適切な順序で情報を整理し、重複や断片化された情報を削除・整理してください。
`;

  const config = {
    maxOutputTokens: 8192,
    temperature: 1,
    topP: 0.95,
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

  const generativeModel = vertexAI.preview.getGenerativeModel(modelParams);

  const req: GenerateContentRequest = {
    tools: [],
    contents: [
      {
        role: 'user',
        parts: [{ text: coreMemory }],
      },
    ],
  };

  const res = await generativeModel.generateContent(req);
  const text = res.response.candidates?.[0]?.content.parts?.[0]?.text;
  if (!text) {
    throw new Error('Failed to parse output content');
  }
  return text;
}
