import striptags from 'striptags';
import {
  findAppTimelineSinceId,
  saveAppTimelineSinceId,
} from '../dynamodb/timeline';
import {
  favouriteStatus,
  updateStatus as updateStatusInternal,
  verifyCredentials,
  viewHomeTimeline,
  viewStatus,
} from '../mastodon';
import { MastodonStatus, MastodonToken } from '../types';
import { evaluteTimeline, generateReplyApproach } from './generator';

export default async function readTimeline(token: MastodonToken) {
  const credentials = await verifyCredentials(token);

  const sinceId = await findAppTimelineSinceId();
  const timeline = await viewHomeTimeline(token, {
    limit: 20,
    since_id: sinceId,
  });

  const targetStatuses = timeline
    .map((status) => ({
      ...status,
      text: status.text ?? striptags(status.content),
    }))
    .filter((status) => status.account.id !== credentials.id)
    .filter((status) => status.in_reply_to_id === null)
    .filter((status) => !status.text.startsWith('@'));
  const evaluation = await evaluteTimeline(targetStatuses);
  if ('error' in evaluation) {
    await saveAppTimelineSinceId(sinceId);
    return;
  }

  let sinceIdCursor = sinceId;
  // 下から読むとエラーがあったときに最小限で済む
  const processableEvalutionStatus = [...evaluation].reverse();
  try {
    for (const { status, fav, interest } of processableEvalutionStatus) {
      sinceIdCursor = status.id;
      // 5 ~ 8
      const wantToFav = Math.floor(Math.random() * 4) + 5;
      if (fav > wantToFav) {
        await favouriteStatus(token, status.id);
      }
      // 7 ~ 10
      const wantToReply = Math.random() * 3 + 7;
      if (interest >= wantToReply) {
        await approachReply(token, status);
      }
    }
  } finally {
    if (sinceIdCursor) await saveAppTimelineSinceId(sinceIdCursor);
  }
}

async function approachReply(token: MastodonToken, status: MastodonStatus) {
  const statusDetail = await viewStatus(token, status.id);

  const targetMessage = striptags(status.content);
  const res = await generateReplyApproach(targetMessage);
  if ('error' in res) return;
  const { message } = res;

  const updatedStatus = `@${statusDetail.account.acct} ${message}`;
  await updateStatusInternal(token, {
    status: updatedStatus,
    in_reply_to_id: status.id,
  });
}
