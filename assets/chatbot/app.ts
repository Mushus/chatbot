import { vValidator } from '@hono/valibot-validator';
import { Context, Hono } from 'hono';
import * as v from 'valibot';
import { authorizeStart, createToken } from '../shared/engine/auth';
import { AppName } from '../shared/env/value';

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

    const res = await createToken(code, redirectUri);
    if ('tokenAlreadyExists' in res) return ctx.redirect('/');
    if ('appNotFound' in res) return ctx.redirect('/');

    return ctx.text('success');
  },
);

app.get('/auth', async (ctx) => {
  const redirectUri = getRedirectUri(ctx);

  const authorization = await authorizeStart(redirectUri);
  if ('tokenAlreadyExists' in authorization) return ctx.redirect('/');

  return ctx.redirect(authorization.url.toString());
});

app.post('/api/vertexai', async (ctx) => {
  return ctx.json({ status: 'ok' });
});

function getRedirectUri(ctx: Context): string {
  const myHost = ctx.req.header(HeaderHost);
  return `https://${myHost}/auth/callback`;
}

export default app;
