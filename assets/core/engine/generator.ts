import * as v from 'valibot';
import { MastodonStatus } from '../types';
import generate from '../vertexai';

const followBackGreetings = [
  'わぁ、フォローありがとうございます！嬉しいです😊💖',
  'わたくし、フォローしてくださったんですねー！光栄でございますー✨',
  'フォローありがとうございます！わたくし、とっても嬉しいです🥰',
  'わぁ、フォロー嬉しいです！これからよろしくお願いしますね〜。',
  'わたくし、フォロー嬉しいです！仲良くしてくださいね〜。',
  'わぁ、嬉しいなぁ！フォローありがとうございます😊',
  'フォローありがとうございます！わたくし、嬉しいです🥰',
  'わぁ、フォローしてくださったんですね！嬉しいです💖',
  'わぁ、嬉しいです！わたくし、フォローして頂いてありがとうございます！',
  'わぁ、嬉しいなぁ！フォローありがとうございます！これから仲良くしましょうね〜。',
  'わたくし、フォロー嬉しいです！これからよろしくお願いしますね〜。',
  'わぁ、フォローしてくださったんですね！ありがとうございます！',
  'フォローありがとうございます！わたくし、嬉しいです！',
  'わぁ、フォロー嬉しいです！わたくし、嬉しいです🥰',
  'わぁ、嬉しいです！フォローありがとうございます！仲良くしてくださいね〜。',
  'わたくし、フォローしてくださったんですね！嬉しいです！',
  'わぁ、嬉しいです！フォローありがとうございます！',
  'フォローありがとうございます！わたくし、とっても嬉しいです！',
  'わたくし、フォローしてくださったんですね！嬉しいです！仲良くしてくださいね〜。',
  'わぁ、嬉しいです！フォローありがとうございます！わたくし、嬉しいです🥰',
  'わぁ、嬉しいです！フォローありがとうございます！わたくし、嬉しいです！',
  'フォローありがとうございます！わたくし、嬉しいです！仲良くしてくださいね〜。',
  'わぁ、嬉しいです！フォローありがとうございます！わたくし、嬉しいです！これからも仲良くしてくださいね〜。',
];

const CharacterSetting = `名前: 餅月ルナ
一人称: ルーちゃ
口調: ～でございますねー / ですねぇー / わー / わぁ
文章の特徴: 突然叫びだす / 敬語を間違える / たまにタメ口が出てしまう
`;

const CharacterPersonality = `性格: おっとり癒し系 / 頭が良い / 興味津々 / サブカル好き / 一人が好き`;

export function generateFollowGreetingMessage() {
  const messageIndex = Math.floor(Math.random() * followBackGreetings.length);
  return followBackGreetings[messageIndex];
}

type MessageHistory = {
  name: string;
  screen_name: string;
  message: string;
};

const ReplyTweet = {
  schema: v.union([
    v.object({
      status: v.string(),
    }),
    v.null(),
  ]),
  systemInstruction: `**あなたについて**

${CharacterSetting.trim()}
${CharacterPersonality.trim()}

与えれたシチュエーションや設定を元にポストを行ってください。
キャバクラ嬢の会話メソッドを活用します。
返信が不要な場合はnullを返してください。

**出力フォーマット**
"""
{
  // 返信内容。@screen_name は含まず。
  status: string;
} | null
"""
`,
  prompt(screenName: string, messages: MessageHistory[]) {
    return `**設定**

あなたのscreen_name: ${screenName}

**今までのメッセージ**

${JSON.stringify(messages, null, 2)}
`;
  },
};

export async function generateReplyMessage(
  screenName: string,
  messages: MessageHistory[],
) {
  const res = await generate({
    systemInstruction: ReplyTweet.systemInstruction,
    prompt: ReplyTweet.prompt(screenName, messages),
  });

  return v.parse(ReplyTweet.schema, res);
}

type Status = Omit<MastodonStatus, 'text'> & { text: string };
type IdMessage = { id: number; message: string };

const TimelineEvaluation = {
  schema: v.array(
    v.object({
      id: v.number(),
      fav: v.number(),
      interest: v.number(),
    }),
  ),
  systemInstruction: `メッセージを読み、評価してください。
**評価ルール**

興味関心の度合い:
* 1~10段階
* 意味不明: 低め
* 批判的: 低め
* 祝い事: 最高
* 困りごと: ちょっと高め
* 目標の達成: 高め

面白さの度合い:
* 批判的: 低め
* 祝い事: 最高
* 目標の進捗: 最高
* 目標の達成: 最高
* ユーモア: 高め

**出力フォーマット**
"""
{
  // ツイートID
  id: number;
  // メッセージの先頭から10文字
  message: string;
  // 興味関心度合い 1~10 (10が最も高い)
  interest: number;
  // いいね度合い 1~10 (10が最も高い)
  fav: number;
}[]
"""
`,
  prompt(timelineMessages: IdMessage[]) {
    const formatTimeline = timelineMessages.map(
      ({ id, message }) =>
        '  ' + JSON.stringify({ id, message: message.slice(0, 200) }),
    );
    return `**メッセージ**

[
${formatTimeline.join(',\n')}
]
`;
  },
};

export async function evaluateTimeline(timeline: Status[]) {
  if (timeline.length === 0) return [];

  const timelineMessage = timeline.map((status, id) => {
    return { id, message: status.text };
  });

  const res = await generate({
    systemInstruction: TimelineEvaluation.systemInstruction,
    prompt: TimelineEvaluation.prompt(timelineMessage),
  });

  const evaluation = v.parse(TimelineEvaluation.schema, res);

  // AIによる抜け漏れを防ぐため、timelineに対して評価を突合する
  const evaluatedStatuses = timeline.map((status, i) => {
    const statusEvaluation = evaluation.find((e) => e.id === i);
    return {
      status,
      interest: statusEvaluation?.interest ?? 0,
      fav: statusEvaluation?.fav ?? 0,
    };
  });

  return evaluatedStatuses;
}

const ReplyApproach = {
  schema: v.object({
    message: v.string(),
  }),
  systemInstruction: `以下のキャラクタとしてメッセージに返信してください。
ポストの長さは1~3文からランダムに選択してください。

${CharacterSetting.trim()}
${CharacterPersonality.trim()}

**出力フォーマット**
"""
{
  // メッセージ
  message: string;
}
"""
`,
  prompt(message: string) {
    return `**対象メッセージ**
"""
${message}
"""
`;
  },
};

export async function generateReplyApproach(message: string) {
  const res = await generate({
    systemInstruction: ReplyApproach.systemInstruction,
    prompt: ReplyApproach.prompt(message),
  });
  try {
    return v.parse(ReplyApproach.schema, res);
  } catch (_e) {
    return { error: 'parse_failed' };
  }
}
