import dayjs from 'dayjs';
import {
  queryDailySlogan,
  queryHourlyTodo,
  queryRecentTweetTopics,
  saveDailySlogan,
  saveHourlyTodo,
  saveRecentTweetTopic,
  updateHourlyTodo,
} from '../dynamodb';
import { updateStatus as updateStatusInternal } from '../mastodon';
import { MastodonToken } from '../types';
import {
  generateHourlyTodo,
  generateMonthlySchedule,
  getDailyTweetMessage,
} from './generator';

const TweetFequency = 1 / 10;

export default async function randomPost(token: MastodonToken) {
  if (Math.random() >= TweetFequency) return;

  const now = dayjs();
  const slogan = await getSlogan(now);
  const todo = await getTodo(now, slogan);

  const recentTopics = await queryRecentTweetTopics(10);

  const dailyMessage = await getDailyTweetMessage(now, todo, recentTopics);
  if ('error' in dailyMessage) return;
  const { status, keyword, next } = dailyMessage;

  const year = now.year();
  const month = now.month() + 1;
  const day = now.date();
  const hourly = now.hour();
  await updateHourlyTodo(year, month, day, hourly, next);

  await updateStatusInternal(token, { status });

  const expireAt = now.add(7, 'day').unix();
  await saveRecentTweetTopic(keyword, expireAt);
}

export async function getSlogan(now: dayjs.Dayjs) {
  const year = now.year();
  const month = now.month() + 1;
  const day = now.date();
  const schedule = await queryDailySlogan(year, month, day);
  if (schedule) return schedule;

  const endOfMonth = now.endOf('month').date();
  const schedules = await generateMonthlySchedule(month, endOfMonth);

  const dayKey = day.toString();
  if (!schedules[dayKey]) throw new Error('Invalid schedule');

  const expireAt = dayjs().add(1, 'month').unix();
  await saveDailySlogan(year, month, schedules, expireAt);

  return schedules[dayKey];
}

export async function getTodo(now: dayjs.Dayjs, slogan: string) {
  const hour = now.hour();
  const year = now.year();
  const month = now.month() + 1;
  const day = now.date();
  const todo = await queryHourlyTodo(year, month, day, hour);
  if (todo) return todo;

  const todos = await generateHourlyTodo(slogan);

  const hourKey = hour.toString();
  if (!todos[hourKey]) throw new Error('Invalid schedule');

  const expireAt = dayjs().add(1, 'day').unix();
  await saveHourlyTodo(year, month, day, todos, expireAt);

  return todos[hourKey];
}
