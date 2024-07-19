// import randomPost from './randomPost';
import readNotification from './readNotification';
import readTimeline from './readTimeline';
import { findAppToken } from '../dynamodb/token';
import { verifyCredentials } from '../mastodon';
// import { live } from './live';

export async function batch(): Promise<void> {
  const token = await findAppToken();
  if (!token) return;

  const cred = await verifyCredentials(token);

  const readNotificationPromise = readNotification(token, cred);
  // const randomPostPromise = randomPost(token);
  // const livePromise = live(token, cred);
  const readTimelinePromise = readTimeline(token, cred);

  await Promise.all([
    readNotificationPromise,
    // livePromise,
    // randomPostPromise,
    readTimelinePromise,
  ]);
}
