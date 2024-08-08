import 'dotenv/config';
import '../core/config';

import dayjs from 'dayjs';
import { createInterface } from 'readline/promises';
import * as v from 'valibot';
import { appendChatLogs, getChatLogs } from './dynamodb/chatLog';
import { coreMemoryGet, coreMemorySet } from './dynamodb/coreMemory';
import {
  getLongTermMemory,
  setLongTermMemory,
} from './dynamodb/longTermMemory';
import generate from './ai/gemini';
import { Content } from './ai/types';

const CoreMemoryKeyPersona = 'persona';
const CoreMemoryKeyUser = 'user';

async function main() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const message = await rl.question('input: ');
  rl.close();
  await processChatbot(message);
}

async function processChatbot(message: string) {
  const logs = await getChatLogs();

  const now = dayjs();
  const contents: Content[] = [
    ...logs.map(
      (log): Content => ({
        role: log.user === CoreMemoryKeyPersona ? 'agent' : 'user',
        content: log.content,
        datetime: log.datetime,
      }),
    ),
    {
      role: 'user',
      content: message,
      datetime: now,
    },
  ];

  // ログに追加
  await appendChatLogs(now, CoreMemoryKeyUser, message);

  for (let i = 0; i < 5; i++) {
    const personaCoreMemory = await coreMemoryGet(CoreMemoryKeyPersona);
    const userCoreMemory = await coreMemoryGet(CoreMemoryKeyUser);
    const persona = {
      name: coreMemoryGetName(personaCoreMemory),
      coreMemory: personaCoreMemory,
    };
    const user = {
      name: coreMemoryGetName(userCoreMemory),
      coreMemory: userCoreMemory,
    };

    const output = await generate(contents, persona, user);
    const now = dayjs();
    console.log(output);
    if (!output) {
      console.error('Failed to parse output content');
      return;
    }
    contents.push({ ...output, datetime: now });
    const funcCalls = parseOutputContent(output);
    for (const funcCall of funcCalls) {
      if ('think' in funcCall) console.log('💭', funcCall.think);
      switch (funcCall.name) {
        case 'sendMessage':
          console.log('Sending message...', funcCall.content);
          await appendChatLogs(dayjs(), CoreMemoryKeyPersona, funcCall.content);
          return;
        case 'personaCoreMemoryUpdate':
          console.log('Appending persona core memory...', funcCall.content);
          await coreMemoryUpdate(
            CoreMemoryKeyPersona,
            funcCall.action,
            funcCall.content,
          );
          contents.push({
            role: 'system',
            content: 'personaCoreMemoryAppend: done',
            datetime: dayjs(),
          });
          break;
        case 'userCoreMemoryUpdate':
          console.log('Appending user core memory...', funcCall.content);
          await coreMemoryUpdate(
            CoreMemoryKeyUser,
            funcCall.action,
            funcCall.content,
          );
          contents.push({ role: 'system', content: 'done', datetime: dayjs() });
          break;
        case 'archivalMemoryInsert':
          console.log(
            'Inserting archival memory...',
            funcCall.keyword,
            funcCall.content,
          );
          await setLongTermMemory(dayjs(), funcCall.keyword, funcCall.content);
          contents.push({
            role: 'system',
            content: 'archivalMemoryInsert: done',
            datetime: dayjs(),
          });
          break;
        case 'archivalMemorySearch': {
          console.log('Recalling...', funcCall.keyword);
          const res = await getLongTermMemory(funcCall.keyword);
          contents.push({
            role: 'system',
            content:
              'recall\n===\n' +
              (res.length > 0 ? res.join('\n') : 'cannot remember'),
            datetime: dayjs(),
          });
          break;
        }
      }
    }
  }
}

void main();

async function coreMemoryUpdate(
  name: string,
  action: 'add' | 'replace',
  content: string,
) {
  let context: string;
  if (action == 'add') {
    const old = await coreMemoryGet(name);
    context = old + '\n' + content;
  } else {
    context = content;
  }

  // 正規化
  context = context
    .split('\n')
    .map((text) => text.trim())
    .filter((line) => line !== '')
    .join('\n');

  if (!context.includes('名前: ')) {
    throw new RemoveUserNameNotAllow();
  }

  await coreMemorySet(name, context);
}

function coreMemoryGetName(coreMemory: string) {
  const name = coreMemory.match(/名前: (.+)/)?.[1] ?? '不明';
  return name;
}

class RemoveUserNameNotAllow extends Error {
  constructor() {
    super('remove user name not allow');
  }
}

const FunctionCallingSchema = v.variant('name', [
  v.object({
    think: v.optional(v.string()),
    name: v.literal('sendMessage'),
    content: v.string(),
  }),
  v.object({
    think: v.optional(v.string()),
    name: v.literal('personaCoreMemoryUpdate'),
    action: v.union([v.literal('add'), v.literal('replace')]),
    content: v.string(),
  }),
  v.object({
    think: v.optional(v.string()),
    name: v.literal('userCoreMemoryUpdate'),
    action: v.union([v.literal('add'), v.literal('replace')]),
    content: v.string(),
  }),
  v.object({
    think: v.optional(v.string()),
    name: v.literal('archivalMemoryInsert'),
    keyword: v.array(v.string()),
    content: v.string(),
  }),
  v.object({
    think: v.optional(v.string()),
    summary: v.optional(v.string()),
    name: v.literal('archivalMemorySearch'),
    keyword: v.array(v.string()),
  }),
]);

function parseOutputContent(content: Omit<Content, 'datetime'>) {
  const json = content.content;
  if (!json) {
    console.error(JSON.stringify(content, null, 2));
    throw new Error('Failed to parse output content');
  }

  let func: unknown;
  try {
    func = JSON.parse(json) as unknown;
  } catch (e) {
    console.error(json);
    throw e;
  }
  // 複数返してくることがある。
  // お得なので対応する
  if (Array.isArray(func)) {
    try {
      return func.map((f) => v.parse(FunctionCallingSchema, f));
    } catch (e) {
      console.error(json);
      throw e;
    }
  }
  return [v.parse(FunctionCallingSchema, func)];
}
