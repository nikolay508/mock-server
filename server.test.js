const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('./server');
const http = require('node:http');

for (const mode of ['local server', 'Vercel handler']) {
test(`${mode} supports the full CRUD lesson and error examples`, async t => {
  const server = mode === 'local server' ? createServer() : http.createServer(require('./api'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, method = 'GET', body) => fetch(base + path, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });

  assert.equal((await (await request('/users')).json()).total, 3);
  assert.equal((await (await request('/users?search=ALEX')).json()).total, 1);
  const created = await request('/users', 'POST', { name: 'Taylor', email: 'taylor@example.com' });
  assert.equal(created.status, 201);
  const { data: user } = await created.json();
  assert.equal(created.headers.get('location'), `/users/${user.id}`);
  const path = `/users/${user.id}`;
  assert.deepEqual((await (await request(path)).json()).data, user);
  assert.equal((await request(path, 'PUT', { name: 'Incomplete' })).status, 400);
  const put = await request(path, 'PUT', { name: 'Replaced', email: 'new@example.com' });
  assert.equal(put.status, 200);
  assert.equal((await put.json()).data.email, 'new@example.com');
  const patch = await request(path, 'PATCH', { name: 'Patched' });
  assert.deepEqual((await patch.json()).data, { id: user.id, name: 'Patched', email: 'new@example.com' });
  assert.equal((await request(path, 'PATCH', { id: 99 })).status, 400);
  const deleted = await request(path, 'DELETE');
  assert.equal(deleted.status, 204);
  assert.equal(await deleted.text(), '');
  assert.equal((await request(path)).status, 404);
  assert.equal((await request('/users', 'POST', { name: '', email: 'invalid' })).status, 400);
  assert.equal((await fetch(base + '/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' })).status, 400);
  assert.equal((await fetch(base + '/users', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await request('/users', 'DELETE')).status, 405);
  assert.equal((await request('/missing')).status, 404);
  assert.equal((await request('/protected')).status, 401);
  assert.equal((await fetch(base + '/protected', { headers: { Authorization: 'Bearer classroom-secret' } })).status, 200);
  const echo = await (await request('/echo?lesson=http', 'POST', { hello: 'students' })).json();
  assert.deepEqual(echo.body, { hello: 'students' });
  assert.deepEqual(echo.query, { lesson: 'http' });
  const options = await request('/users', 'OPTIONS');
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('access-control-allow-origin'), '*');
  assert.equal(await (await request('/users', 'HEAD')).text(), '');
  assert.equal((await request('/reset', 'POST')).status, 200);
  assert.equal((await (await request('/users')).json()).total, 3);
});
}

test('Vercel handler accepts an already parsed JSON request body', async () => {
  const { createHandler } = require('./server');
  const handler = createHandler();
  let status;
  let response;
  await handler({
    method: 'POST', url: '/users',
    headers: { 'content-type': 'application/json' },
    body: { name: 'Vercel Student', email: 'student@example.com' },
  }, {
    setHeader() {},
    writeHead(code) { status = code; },
    end(body) { response = JSON.parse(body); },
  });
  assert.equal(status, 201);
  assert.equal(response.data.name, 'Vercel Student');
});
