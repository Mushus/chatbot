import { Hono } from 'hono';

const app = new Hono();

app.get('/', async (ctx) => {
  return ctx.html(
    <html>
      <head>
        <title>Dashboard</title>
      </head>
      <body></body>
    </html>,
  );
});

export default app;
