import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { findAppToken } from '../dynamodb';
import randomPost from './randomPost';
import readNotification from './readNotification';
import readTimeline from './readTimeline';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

export async function batch(): Promise<void> {
  const token = await findAppToken();
  if (!token) return;

  const readNotificationPromise = readNotification(token);
  const randomPostPromise = randomPost(token);
  const readTimelinePromise = readTimeline(token);

  await Promise.all([
    readNotificationPromise,
    randomPostPromise,
    readTimelinePromise,
  ]);
}
