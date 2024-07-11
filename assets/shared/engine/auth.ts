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

/**
 *
 * @param code
 * @param redirectUri
 * @returns
 * @throws AppNotFoundError
 */
export async function createToken(
  code: string,
  redirectUri: string,
): Promise<MastodonToken> {
  const tokenInStorage = await findAppToken();
  if (tokenInStorage) return tokenInStorage;

  const app = await findApp();
  if (!app) throw new AppNotFoundError('App not found');

  const newToken = await createAppToken(app, code, redirectUri);
  await saveApiToken(newToken);

  return newToken;
}

export class AppNotFoundError extends Error {}
