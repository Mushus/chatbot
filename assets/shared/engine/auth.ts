import { findApp, findAppToken, saveApiToken, saveApp } from '../dynamodb';
import { createApp, createAppToken, createAuthorizationUrl } from '../mastodon';
import { MastodonToken } from '../types';

export async function authorizeStart(
  redirectUri: string,
): Promise<{ url: URL } | { error: 'tokenAlreadyExists' }> {
  const token = await findAppToken();
  if (token) return { error: 'tokenAlreadyExists' };

  let app = await findApp();
  if (!app) {
    app = await createApp(redirectUri);
    await saveApp(app);
  }

  const authorizeUrl = createAuthorizationUrl(redirectUri, app);
  return { url: authorizeUrl };
}

export async function createToken(
  code: string,
  redirectUri: string,
): Promise<
  | { token: MastodonToken }
  | { error: 'tokenAlreadyExists' }
  | { error: 'appNotFound' }
> {
  {
    const token = await findAppToken();
    if (token) return { error: 'tokenAlreadyExists' };
  }

  const app = await findApp();
  if (!app) return { error: 'appNotFound' };

  const token = await createAppToken(app, code, redirectUri);
  await saveApiToken(token);

  return { token };
}
