import 'dotenv/config';
import '../core/config';

import dayjs from 'dayjs';
import { createInterface } from 'readline/promises';
import generate from './ai/gemini/index';
import { Content } from './ai/types';
import { getChatLogs } from './dynamodb/chatLog';
import { coreMemoryGet } from './dynamodb/coreMemory';

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
  // await appendChatLogs(now, CoreMemoryKeyUser, message);

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
  console.log(output);
}

void main();

function coreMemoryGetName(coreMemory: string) {
  const name = coreMemory.match(/名前: (.+)/)?.[1] ?? '不明';
  return name;
}
