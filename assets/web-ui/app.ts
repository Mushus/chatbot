import { type Context, Hono } from 'hono';
import { vValidator } from '@hono/valibot-validator';
import * as v from 'valibot';
import {
  AppNotFoundError,
  authorizeStart,
  AuthorizeUrl,
  createToken,
  TokenAlreadyExists,
} from '../core/engine/auth';
import { AppName } from '../core/env/value';

const HeaderHost = 'Host';

const app = new Hono();

app.get('/', (ctx) => {
  return ctx.text(AppName);
});

app.get(
  '/auth/callback',
  vValidator('query', v.object({ code: v.string() })),
  async (ctx) => {
    const { code } = ctx.req.valid('query');
    const redirectUri = getRedirectUri(ctx);

    try {
      await createToken(code, redirectUri);
    } catch (e: unknown) {
      if (e instanceof AppNotFoundError) {
        return ctx.redirect('/');
      }
      throw e;
    }

    return ctx.text('success');
  },
);

app.get('/auth', async (ctx) => {
  const redirectUri = getRedirectUri(ctx);

  let authorization: AuthorizeUrl;
  try {
    authorization = await authorizeStart(redirectUri);
  } catch (e) {
    if (e instanceof TokenAlreadyExists) {
      return ctx.redirect('/');
    }
    throw e;
  }

  return ctx.redirect(authorization.url.toString());
});

function getRedirectUri(ctx: Context): string {
  const myHost = ctx.req.header(HeaderHost);
  if (typeof myHost !== 'string') {
    throw new Error('Host header is not found');
  }
  return `https://${myHost}/auth/callback`;
}

export default app;
