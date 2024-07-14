import dayjs from 'dayjs';
import * as v from 'valibot';
import { MastodonStatus } from '../types';
import generate from '../vertexai';
import { MinutesTimeFormat, TzTokyo } from '../const';

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

const CharacterPersonality = `性格: おっとり癒し系 / 天然 / 興味津々 / サブカル好き / 一人が好き`;

export function generateFollowGreetingMessage() {
  const messageIndex = Math.floor(Math.random() * followBackGreetings.length);
  return followBackGreetings[messageIndex];
}

const ActionsSchema = v.object({
  /** 覚醒度 -1 ~ +1*/
  arousal: v.number(),
  /** 感情価 -1 ~ +1 */
  valence: v.number(),
  /** 思考 */
  thinking: v.string(),
  /** 行動 */
  action: v.string(),
  /** 行動後の場所 */
  nextLocation: v.string(),
  /** 行動後のシチュエーション */
  nextSituation: v.string(),
});

const ActionsSystemInstruction = `**あなたについて**

${CharacterPersonality.trim()}
`;

function timeMessage(time: dayjs.Dayjs) {
  switch (time.hour()) {
    case 6:
    case 7:
      return '朝です。太陽が登ってきました。';
    case 8:
      return '朝食の時間です。';
    case 9:
    case 10:
    case 11:
      return 'おはようございます。';
    case 12:
      return '昼ご飯の時間です。';
    case 13:
    case 14:
      return 'こんにちは。';
    case 15:
      return 'おやつの時間です。';
    case 16:
    case 17:
      return 'こんにちは。';
    case 18:
      return '日が落ちて暗くなってきました。';
    case 19:
      return '夕飯の時間です。';
    case 20:
    case 21:
    case 22:
    case 23:
      return '就寝時間です。';
    case 0:
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      return '就寝時間です。';
    default:
      return '';
  }
}

function actionPrompt(state: State) {
  const time = state.time.tz(TzTokyo);
  return `${timeMessage(time)}
現在時刻は「${time.format(MinutesTimeFormat)}」です。
何をしますか？

**過去の行動履歴**

上から新しい順に並んでいます。
${state.stateHistory.map(({ time, location, situation }) => JSON.stringify({ time: time.tz(TzTokyo).format(MinutesTimeFormat), location, situation })).join('\n')}

**出力フォーマット**
"""
{
  // 覚醒度 -1 ~ +1
  arousal: number;
  // 感情価 -1 ~ +1
  valence: number;
  // 思考
  thinking: string;
  // 思考した結果の行動
  action: string;
  // 行動後の場所
  nextLocation: string;
  // 行動後のシチュエーション
  nextSituation: string;
}
"""
`;
}

type State = {
  time: dayjs.Dayjs;
  stateHistory: {
    time: dayjs.Dayjs;
    location: string;
    situation: string;
  }[];
};

export async function generateAction(state: State) {
  const res = await generate({
    systemInstruction: ActionsSystemInstruction,
    prompt: actionPrompt(state),
  });

  return v.parse(ActionsSchema, res);
}

type MessageHistory = {
  name: string;
  screen_name: string;
  message: string;
};

const ReplyTweet = {
  schema: v.object({
    status: v.string(),
  }),
  systemInstruction: `以下のキャラクタとして返信を行ってください。

${CharacterSetting.trim()}
${CharacterPersonality.trim()}

与えれたシチュエーションや設定を元にポストを行ってください。

**出力フォーマット**
"""
{
  // 返信内容。@screen_name は含まず。
  status: string;
}
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
    const formatTimeline = timelineMessages.map(({ id, message }) =>
      JSON.stringify({ id, message: message.slice(0, 200) }),
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
