import dayjs from 'dayjs';

export type Content = {
  role: 'user' | 'agent' | 'system';
  content: string;
  datetime: dayjs.Dayjs;
};
export type Contents = Content[];

export type User = {
  name: string;
  coreMemory: string;
};
