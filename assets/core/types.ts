import * as v from 'valibot';

export const MastodonAppSchema = v.object({
  client_id: v.string(),
  client_secret: v.string(),
  id: v.optional(v.string()),
  name: v.optional(v.string()),
  redirect_uri: v.optional(v.string()),
  vapid_key: v.optional(v.string()),
  website: v.optional(v.string()),
});

export type MastodonApp = v.InferInput<typeof MastodonAppSchema>;

export const MastodonTokenSchema = v.object({
  access_token: v.string(),
  token_type: v.string(),
  scope: v.string(),
  created_at: v.optional(v.number()),
});

export type MastodonToken = v.InferInput<typeof MastodonTokenSchema>;

export type MastodonAccount = {
  id: string;
  username: string;
  acct: string;
};

export type MastodonStatus = {
  id: string;
  uri: string;
  url: string;
  in_reply_to_id: string | null;
  in_reply_to_account_id: string | null;
  account: MastodonAccount;
  content: string;
  mentions: MastodonMention[];
  text: string | null;
  reblog: MastodonStatus | null;
};

export type MastodonMention = {
  id: string;
  username: string;
  url: string;
  acct: string;
};

export type MastodonFollowNotification = {
  id: string;
  type: 'follow';
  created_at: string;
  account: MastodonAccount;
};

export type MastodonMentionNotification = {
  id: string;
  type: 'mention';
  created_at: string;
  in_reply_to_id: string;
  status: MastodonStatus;
};

export type MastodonNotification =
  | MastodonFollowNotification
  | MastodonMentionNotification
  | {
      id: string;
      type: never;
      created_at: string;
    };

export type MastodonCredentials = {
  id: string;
  username: string;
  acct: string;
};
