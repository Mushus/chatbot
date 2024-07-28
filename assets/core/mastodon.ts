import { ofetch } from 'ofetch';
import { AppName, MastodonDomain } from './env/value';
import {
  MastodonAccount,
  MastodonApp,
  MastodonCredentials,
  MastodonNotification,
  MastodonStatus,
  MastodonToken,
} from './types';
import querystring from 'querystring';

export type PaginationResult<T extends unknown[]> = {
  data: T;
  next: () => Promise<PaginationResult<T>>;
  prev: () => Promise<PaginationResult<T>>;
};

const AppScope = 'read write follow';
const BaseUrl = `https://${MastodonDomain}`;

const fedClient = ofetch.create({
  baseURL: BaseUrl,
  onResponseError({ request, response }) {
    console.error(
      '[fetch response error]',
      request,
      response.status,
      response._data,
    );
  },
});

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * ページネーション対応リクエストを送る
 */
async function requestGet<T>(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });

  const data = (await res.json()) as T;
  const links = createPagination<T>(res.headers, headers);

  return {
    data,
    ...links,
  };
}

function createPagination<T>(
  responseHeaders: Headers,
  requestHeaders: Record<string, string>,
) {
  const links = responseHeaders.get('link')?.split(',') ?? [];

  const linksUrls = { next: '', prev: '' };
  for (const link of links) {
    const [urlSection = '', relSection = ''] = link.split(';');
    const urlMatch = urlSection.match(/<(.+)>/);
    if (!urlMatch || !urlMatch[1]) throw new Error("Can't find url");
    const url = urlMatch[1];
    const relMatch = relSection.match(/rel="(.+)"/);
    if (!relMatch || !relMatch[1]) throw new Error("Can't find rel");
    const rel = relMatch[1] as 'next' | 'prev';
    linksUrls[rel] = url;
  }

  return {
    next() {
      return requestGet<T>(linksUrls['next'], requestHeaders);
    },
    prev() {
      return requestGet<T>(linksUrls['prev'], requestHeaders);
    },
  };
}

/**
 * すべてのページを取得する
 * @param pagingResult
 * @returns
 */
export async function pagingAll<T>(
  pagingResult: Promise<PaginationResult<T[]>>,
) {
  const users: T[] = [];
  let res = await pagingResult;
  while (res.data.length > 0) {
    users.push(...res.data);
    res = await res.next();
  }
  return users;
}

export async function createApp(redirectUri: string) {
  const form = new FormData();
  form.append('client_name', AppName);
  form.append('redirect_uris', redirectUri);
  form.append('scope', AppScope);
  const app = await fedClient<MastodonApp>('/api/v1/apps', {
    method: 'POST',
    body: form,
  });

  return app;
}

export function createAuthorizationUrl(redirectUri: string, app: MastodonApp) {
  const url = new URL(`${BaseUrl}/oauth/authorize`);
  url.searchParams.set('client_id', app.client_id);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', AppScope);

  return url;
}

export async function createAppToken(
  app: MastodonApp,
  code: string,
  redirectUri: string,
) {
  const form = new FormData();
  form.append('grant_type', 'authorization_code');
  form.append('client_id', app.client_id);
  form.append('client_secret', app.client_secret);
  form.append('code', code);
  form.append('scope', AppScope);
  form.append('redirect_uri', redirectUri);
  const res = await fedClient<MastodonToken>('/oauth/token', {
    method: 'POST',
    body: form,
  });

  return res;
}

export async function getAllNotifications(
  token: MastodonToken,
  param: {
    /** max: 80 */
    limit?: number | undefined;
    min_id?: string | undefined;
    max_id?: string | undefined;
    since_id?: string | undefined;
  },
) {
  const res = await fedClient<MastodonNotification[]>('/api/v1/notifications', {
    query: param,
    headers: authHeader(token.access_token),
  });

  return res;
}

/**
 * https://docs.joinmastodon.org/methods/accounts/#follow
 * Follow the given account. Can also be used to update whether to show reblogs or enable notifications.
 */
export async function follow(token: MastodonToken, accountId: string) {
  const id = encodeURIComponent(accountId);
  await fedClient(`/api/v1/accounts/${id}/follow`, {
    method: 'POST',
    headers: authHeader(token.access_token),
  });
}

/**
 * https://docs.joinmastodon.org/methods/accounts/#unfollow
 * Unfollow the given account.
 */
export async function unfollow(token: MastodonToken, accountId: string) {
  const id = encodeURIComponent(accountId);
  await fedClient(`/api/v1/accounts/${id}/unfollow`, {
    method: 'POST',
    headers: authHeader(token.access_token),
  });
}

export async function verifyCredentials(token: MastodonToken) {
  const res = await fedClient<MastodonCredentials>(
    '/api/v1/accounts/verify_credentials',
    {
      headers: authHeader(token.access_token),
    },
  );

  return res;
}
/**
 * /api/v1/accounts/:id/followers
 * View information about a profile.
 * @param token
 * @param id
 * @returns
 */
export async function getAccount(token: MastodonToken, id: string) {
  const res = await fedClient<MastodonCredentials>(`/api/v1/accounts/${id}`, {
    headers: authHeader(token.access_token),
  });

  return res;
}

/**
 * https://docs.joinmastodon.org/methods/accounts/#statuses
 * Statuses posted to the given account.
 */
export async function getAccountsStatuses(
  token: MastodonToken,
  id: string,
  params?: {
    /** Integer. Maximum number of results to return. Defaults to 20 statuses. Max 40 statuses. */
    limit?: number | undefined;
    /** String. All results returned will be greater than this ID. In effect, sets a lower bound on results. */
    since_id?: string | undefined;
  },
) {
  querystring.encode(params);
  const res = await fedClient<MastodonStatus[]>(
    `/api/v1/accounts/${id}/statuses`,
    {
      query: params ?? {},
      headers: authHeader(token.access_token),
    },
  );

  return res;
}

/**
 * https://docs.joinmastodon.org/methods/accounts/#followers
 * Accounts which follow the given account, if network is not hidden by the account owner.
 */
export async function getAccountsFollowers(
  token: MastodonToken,
  id: string,
  params: { limit?: number | undefined },
) {
  const query = querystring.stringify(params);
  const url = `${BaseUrl}/api/v1/accounts/${id}/followers?${query}`;
  const headers = authHeader(token.access_token);
  return await requestGet<MastodonAccount[]>(url, headers);
}

/**
 * https://docs.joinmastodon.org/methods/accounts/#following
 * Accounts which the given account is following, if network is not hidden by the account owner.
 */
export async function getAccountsFollowing(
  token: MastodonToken,
  id: string,
  params: { limit?: number | undefined },
) {
  const query = querystring.stringify(params);
  const url = `${BaseUrl}/api/v1/accounts/${id}/following?${query}`;
  const headers = authHeader(token.access_token);
  return await requestGet<MastodonAccount[]>(url, headers);
}

/** https://docs.joinmastodon.org/methods/timelines/#home */
export async function viewHomeTimeline(
  token: MastodonToken,
  param: {
    max_id?: string | undefined;
    since_id?: string | undefined;
    min_id?: string | undefined;
    /** max: 40 */
    limit?: number | undefined;
  },
) {
  const res = await fedClient<MastodonStatus[]>('/api/v1/timelines/home', {
    headers: authHeader(token.access_token),
    query: param,
  });

  return res;
}

export async function updateStatus(
  token: MastodonToken,
  param: { status: string; in_reply_to_id?: string },
) {
  const res = await fedClient<MastodonStatus>('/api/v1/statuses', {
    method: 'POST',
    headers: authHeader(token.access_token),
    body: { ...param, visibility: 'public' },
  });

  return res;
}

export async function viewStatus(token: MastodonToken, id: string) {
  const res = await fedClient<MastodonStatus>(`/api/v1/statuses/${id}`, {
    headers: authHeader(token.access_token),
  });

  return res;
}

export async function favouriteStatus(token: MastodonToken, id: string) {
  await fedClient(`/api/v1/statuses/${id}/favourite`, {
    method: 'POST',
    headers: authHeader(token.access_token),
  });
}
