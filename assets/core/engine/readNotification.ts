import striptags from 'striptags';
import {
  findNotificationSinceId,
  saveNotificationSinceId,
} from '../dynamodb/notification';
import {
  follow,
  getAllNotifications,
  updateStatus as updateStatusInternal,
  viewStatus,
} from '../mastodon';
import {
  MastodonAccount,
  MastodonCredentials,
  MastodonMentionNotification,
  MastodonNotification,
  MastodonToken,
} from '../types';
import {
  generateFollowGreetingMessage,
  generateReplyMessage,
} from './generator';

export default async function readNotification(
  token: MastodonToken,
  cred: MastodonCredentials,
) {
  await processNotification(token, async (notification) => {
    switch (notification.type) {
      case 'follow': {
        await follow(token, notification.account.id);
        await postGreetingStatus(token, notification.account);
        break;
      }
      case 'mention': {
        await responseReply(token, cred, notification);
        break;
      }
    }
    console.log(notification);
  });
}

async function processNotification(
  token: MastodonToken,
  process: (notification: MastodonNotification) => Promise<void>,
) {
  let sinceId = await findNotificationSinceId();
  if (!sinceId) {
    // １件だけ取得して保存して次に回す
    const res = await getAllNotifications(token, {
      limit: 1,
    });
    const sinceId = res[0]?.id;
    if (sinceId) await saveNotificationSinceId(sinceId);
    return;
  }

  const notifications = await getAllNotifications(token, {
    limit: 80,
    since_id: sinceId,
  });
  if (notifications.length === 0) return;

  const processTargets = [...notifications].reverse();
  try {
    for (const notification of processTargets) {
      sinceId = notification.id;
      await process(notification);
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
  cred: MastodonCredentials,
  mention: MastodonMentionNotification,
) {
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

  const { status } = await generateReplyMessage(cred.username, messages);

  const replyTarget = mention.status;
  const updatedStatus = `@${replyTarget.account.acct} ${status}`;
  await updateStatusInternal(token, {
    status: updatedStatus,
    in_reply_to_id: replyTarget.id,
  });
}
