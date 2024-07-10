import striptags from 'striptags';
import { findNotificationSinceId, saveNotificationSinceId } from '../dynamodb';
import {
  follow,
  getAllNotifications,
  updateStatus as updateStatusInternal,
  verifyCredentials,
  viewStatus,
} from '../mastodon';
import {
  MastodonAccount,
  MastodonMentionNotification,
  MastodonNotification,
  MastodonToken,
} from '../types';
import {
  generateFollowGreetingMessage,
  generateReplyMessage,
} from './generator';

export default async function readNotification(token: MastodonToken) {
  let sinceId = await findNotificationSinceId();

  const notifications: MastodonNotification[] = [];
  for (;;) {
    const minId =
      notifications.length === 0
        ? undefined
        : notifications[notifications.length - 1].id;
    const res = await getAllNotifications(token, {
      limit: 80,
      since_id: sinceId,
      min_id: minId,
    });
    if (!res.length) break;

    notifications.push(...res);
  }

  const processTargets = [...notifications].reverse();
  try {
    for (const notification of processTargets) {
      sinceId = notification.id;

      switch (notification.type) {
        case 'follow': {
          await follow(token, notification.account.id);
          await postGreetingStatus(token, notification.account);
          break;
        }
        case 'mention': {
          await responseReply(token, notification);
          break;
        }
      }
      console.log(notification);
    }
  } finally {
    if (sinceId) await saveNotificationSinceId(sinceId);
  }
}

async function postGreetingStatus(
  token: MastodonToken,
  account: MastodonAccount,
) {
  const greetingMessage = generateFollowGreetingMessage();

  const status = `@${account.acct} ${greetingMessage}`;
  await updateStatusInternal(token, { status });
}

async function responseReply(
  token: MastodonToken,
  mention: MastodonMentionNotification,
) {
  const credentials = await verifyCredentials(token);

  const statusList = [mention.status];
  let statusCursor = mention.status;
  for (let i = 0; i < 5; i++) {
    if (!statusCursor.in_reply_to_id) break;
    statusCursor = await viewStatus(token, statusCursor.in_reply_to_id);
    statusList.push(statusCursor);
  }

  const messages = statusList
    .map((status) => {
      const name = status.account.username;
      const screen_name = status.account.acct;
      const text = status.text ?? striptags(status.content);
      const message = text.slice(0, 200);
      return { name, screen_name, message };
    })
    .reverse();

  const reply = await generateReplyMessage(credentials.username, messages);
  if ('error' in reply) return;
  const { status } = reply;

  const replyTarget = mention.status;
  const updatedStatus = `@${replyTarget.account.acct} ${status}`;
  await updateStatusInternal(token, {
    status: updatedStatus,
    in_reply_to_id: replyTarget.id,
  });
}