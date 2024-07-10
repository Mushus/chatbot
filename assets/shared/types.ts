export type MastodonApp = {
  client_id: string;
  client_secret: string;
  id?: string;
  name?: string;
  redirect_uri?: string;
  vapid_key?: string;
  website?: string;
};

export type MastodonToken = {
  access_token: string;
  token_type: string;
  scope: string;
  created_at?: number;
};

export type MastodonAccount = {
  id: string;
  username: string;
  acct: string;
};

export type MastodonStatus = {
  id: string;
  uri: string;
  url: string;
  in_reply_to_id?: string;
  in_reply_to_account_id?: string;
  account: MastodonAccount;
  content: string;
  mentions: MastodonMention[];
  text: string | null;
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
