import { ofetch } from 'ofetch';
import { AppName, MastodonDomain } from './env/value';
import {
  MastodonApp,
  MastodonCredentials,
  MastodonNotification,
  MastodonStatus,
  MastodonToken,
} from './types';

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

export async function follow(token: MastodonToken, accountId: string) {
  const id = encodeURIComponent(accountId);
  await fedClient(`/api/v1/accounts/${id}/follow`, {
    method: 'POST',
    headers: authHeader(token.access_token),
  });
}

export async function viewStatus(token: MastodonToken, id: string) {
  const res = await fedClient<MastodonStatus>(`/api/v1/statuses/${id}`, {
    headers: authHeader(token.access_token),
  });

  return res;
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

export async function favouriteStatus(token: MastodonToken, id: string) {
  await fedClient(`/api/v1/statuses/${id}/favourite`, {
    method: 'POST',
    headers: authHeader(token.access_token),
  });
}
