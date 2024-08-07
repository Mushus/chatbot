import striptags from 'striptags';
import {
  findAppTimelineSinceId,
  saveAppTimelineSinceId,
} from '../dynamodb/timeline';
import {
  favouriteStatus,
  updateStatus as updateStatusInternal,
  viewHomeTimeline,
  viewStatus,
} from '../mastodon';
import { MastodonCredentials, MastodonStatus, MastodonToken } from '../types';
import { evaluateTimeline, generateReplyApproach } from './generator';

export default async function readTimeline(
  token: MastodonToken,
  cred: MastodonCredentials,
) {
  const sinceId = await findAppTimelineSinceId();
  const timeline = await viewHomeTimeline(token, {
    limit: 20,
    since_id: sinceId,
  });

  const readTargetStatus = timeline
    .map((status) => ({
      ...status,
      text: status.text ?? striptags(status.content),
    }))
    .filter((status) => status.reblog === null) // isReblog
    .filter((status) => status.account.id !== cred.id) // myself
    .filter((status) => status.in_reply_to_id === null) // isNotReply
    .filter((status) => !status.text.startsWith('@')); // isNotMention
  const evaluation = await evaluateTimeline(readTargetStatus);
  if ('error' in evaluation) {
    return;
  }

  const statusEvaluations = Object.fromEntries(
    evaluation.map((e) => [e.status.id, e] as const),
  );

  let sinceIdCursor = sinceId;
  // 下から読むとエラーがあったときに最小限で済む
  const readableTimeline = [...timeline].reverse();
  try {
    for (const status of readableTimeline) {
      sinceIdCursor = status.id;

      // not evaluated
      const statusEvaluation = statusEvaluations[status.id];
      if (statusEvaluation === undefined) continue;

      const { fav, interest } = statusEvaluation;

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
