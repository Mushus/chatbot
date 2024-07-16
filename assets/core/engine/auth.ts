import { findApp, saveApp } from '../dynamodb/app';
import { findAppToken, saveApiToken } from '../dynamodb/token';
import { createApp, createAppToken, createAuthorizationUrl } from '../mastodon';
import { MastodonToken } from '../types';

export type AuthorizeUrl = {
  url: URL;
};

export async function authorizeStart(
  redirectUri: string,
): Promise<AuthorizeUrl> {
  const token = await findAppToken();
  if (token) throw new TokenAlreadyExists();

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
  if (!app) throw new AppNotFoundError();

  const newToken = await createAppToken(app, code, redirectUri);
  await saveApiToken(newToken);

  return newToken;
}

export class AppNotFoundError extends Error {
  constructor() {
    super('App not found');
  }
}

export class TokenAlreadyExists extends Error {
  constructor() {
    super('Token already exists');
  }
}
