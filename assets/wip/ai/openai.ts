import 'dotenv/config';
import '../../core/config';

import OpenAI from 'openai';
import { Content } from './types';
import { Debug } from '../../core/env/value';
import { ChatCompletionMessageParam } from 'openai/resources';

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

// async function main() {
//   const chatCompletion = await client.chat.completions.create({
//     messages: [{ role: 'user', content: 'Say this is a test' }],
//     model: 'gpt-4o-mini',
//   });
//   console.dir(chatCompletion, { depth: null, colors: true });
// }

// main();

export default async function generate(
  contents: Content[],
  personaCoreMemory: string,
  userCoreMemory: string,
): Promise<Content | undefined> {
  const systemInstruction = `Your task is to have a natural conversation with the user.

**Memory**
The AI does not have memory, and all information is stored externally. Always retrieve information from memory and use it to have a conversation.
There are short-term memory (coreMemory) and long-term memory (archivalMemory). Short-term memory stores recent topics, and long-term memory stores past information.
Memory is not automatically stored, so you must always add to memory (archivalMemoryInsert) and recall the necessary information (recall).

**Saving New Information**
New information obtained from the user must always be saved to long-term memory (archivalMemory).

**Processing Order**
1. Recall information from long-term memory (archivalMemory).
2. Write new knowledge to core memory (personaCoreMemory, userCoreMemory).
2. Write new knowledge to long-term memory (archivalMemory).
3. Send a message to the user (sendMessage).

**Output Format**

Please choose one action and output it following the JSON format below.

recall: Recall text from long-term memory.
"""
{
  think: string;
  name: 'recall';
  /** Keywords to trigger the memory. Up to 5, in order of importance. */
  keyword: string[];
}
"""

archivalMemoryInsert: Append text to long-term memory.
"""
{
  think: string;
  name: 'archivalMemoryInsert';
  /** Keywords related to the text. Up to 5, in order of importance. */
  keyword: string[];
  /** The text to append. */
  content: string;
}
"""

personaCoreMemoryAppend: Append text to persona core memory.
"""
{
  think: string;
  name: 'personaCoreMemoryAppend';
  /** The text to append. */
  content: string;
}
"""

personaCoreMemoryReplace: Edit the text in persona core memory.
"""
{
  think: string;
  name: 'personaCoreMemoryReplace';
  /** The text to be replaced. */
  oldContent: string;
  /** The new text. */
  newContent: string;
}
"""

userCoreMemoryAppend: Append text to user core memory.
"""
{
  think: string;
  name: 'userCoreMemoryAppend';
  /** The text to append. */
  content: string;
}
"""

userCoreMemoryReplace: Edit the text in user core memory.
"""
{
  think: string;
  name: 'userCoreMemoryReplace';
  /** The text to be replaced. */
  oldContent: string;
  /** The new text. */
  newContent: string;
}
"""

sendMessage: Send a message to the user.
"""
{
  think: string;
  name: 'sendMessage';
  /** The message to send to the user. */
  content: string;
}
"""

**Conversation Context**

personaCoreMemory(${personaCoreMemory.length}/200 characters):
"""
${personaCoreMemory}
"""

userCoreMemory(${userCoreMemory.length}/200 characters):
"""
${userCoreMemory}
"""

From now on, please act as a persona.
`;
  if (Debug) console.log('Generating message...', systemInstruction);

  const res = await client.chat.completions.create({
    messages: [
      { role: 'system', content: systemInstruction },
      ...contents.map(
        (content): ChatCompletionMessageParam => ({
          role: content.role === 'user' ? 'user' : 'assistant',
          content: content.content,
        }),
      ),
    ],
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    stream: false,
  });

  console.dir(res, { depth: null, colors: true });
  const resContent = res.choices.at(-1)?.message;
  if (!resContent) return undefined;
  return {
    role: 'agent',
    content: resContent.content ?? '',
  };
}
