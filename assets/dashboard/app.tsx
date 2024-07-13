import { Hono } from 'hono';
import { queryStateHistory } from '../shared/dynamodb/state';
import { AppName } from '../shared/env/value';

const app = new Hono();

app.get('/', async (ctx) => {
  const history = await queryStateHistory({ limit: 40 });

  return ctx.html(
    <html>
      <head>
        <title>Dashboard</title>
      </head>
      <body>
        <h1>{AppName}</h1>
        <table>
          <tr>
            <th>日付</th>
            <th>場所</th>
            <th>状況</th>
            <th>思考</th>
            <th>行動</th>
          </tr>
          {history.map((state) => (
            <tr>
              <td>{state.time.tz('Asia/Tokyo').format('YYYY/MM/DD HH:mm')}</td>
              <td>{state.location}</td>
              <td>{state.situation}</td>
              <td>{state.thinking}</td>
              <td>{state.action}</td>
            </tr>
          ))}
        </table>
      </body>
    </html>,
  );
});

export default app;
