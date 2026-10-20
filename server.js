const http = require('node:http');

const seedUsers = [
  { id: 1, name: 'Alex Johnson', email: 'alex@example.com' },
  { id: 2, name: 'Sam Rivera', email: 'sam@example.com' },
  { id: 3, name: 'Jamie Chen', email: 'jamie@example.com' },
];

function createHandler() {
  let users;
  let nextId;
  const reset = () => {
    users = seedUsers.map(user => ({ ...user }));
    nextId = 4;
  };
  reset();

  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, data, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
      res.end(status === 204 || req.method === 'HEAD' ? undefined : JSON.stringify(data, null, 2));
    };
    const fail = (status, message, details) => send(status, {
      error: { status, message, ...(details ? { details } : {}) },
    });
    const methodNotAllowed = methods => send(405, {
      error: { status: 405, message: 'Method not allowed' },
    }, { Allow: methods.join(', ') });

    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname.replace(/\/+$/, '') || '/';
      const method = req.method === 'HEAD' ? 'GET' : req.method;
      if (method === 'OPTIONS') return send(204);

      const readJson = async () => {
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
          const error = new Error('Use Content-Type: application/json');
          error.status = 415;
          throw error;
        }
        // Vercel may have already consumed and parsed the request stream.
        if (req.body !== undefined) return req.body;
        let size = 0;
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 1_048_576) {
            const error = new Error('Request body must be under 1 MB');
            error.status = 413;
            throw error;
          }
          chunks.push(chunk);
        }
        try {
          return JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          const error = new Error('Request body must contain valid JSON');
          error.status = 400;
          throw error;
        }
      };
      const validateUser = (body, partial = false) => {
        if (!body || typeof body !== 'object' || Array.isArray(body)) return ['Body must be a JSON object'];
        const errors = [];
        for (const key of Object.keys(body)) {
          if (!['name', 'email'].includes(key)) errors.push(`Unknown field: ${key}`);
        }
        if (!partial || Object.hasOwn(body, 'name')) {
          if (typeof body.name !== 'string' || !body.name.trim()) errors.push('name is required and must be a non-empty string');
        }
        if (!partial || Object.hasOwn(body, 'email')) {
          if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.push('email is required and must be a valid email address');
        }
        if (partial && !Object.keys(body).length) errors.push('Provide at least one field: name or email');
        return errors;
      };

      if (path === '/') {
        if (method !== 'GET') return methodNotAllowed(['GET', 'HEAD']);
        return send(200, {
          message: 'Welcome to the classroom mock API!',
          note: 'Data is stored in memory. Restart the server or POST /reset to restore sample users.',
          endpoints: [
            'GET /health', 'GET /users', 'GET /users?search=alex', 'GET /users/:id',
            'POST /users', 'PUT /users/:id', 'PATCH /users/:id', 'DELETE /users/:id',
            'POST /echo', 'GET /protected (Authorization: Bearer classroom-secret)', 'POST /reset',
          ],
        });
      }
      if (path === '/health') {
        if (method !== 'GET') return methodNotAllowed(['GET', 'HEAD']);
        return send(200, { status: 'ok' });
      }
      if (path === '/reset') {
        if (method !== 'POST') return methodNotAllowed(['POST']);
        reset();
        return send(200, { message: 'Sample data restored', data: users });
      }
      if (path === '/echo') {
        if (method !== 'POST') return methodNotAllowed(['POST']);
        return send(200, {
          method: req.method,
          query: Object.fromEntries(url.searchParams),
          headers: req.headers,
          body: await readJson(),
        });
      }
      if (path === '/protected') {
        if (method !== 'GET') return methodNotAllowed(['GET', 'HEAD']);
        if (req.headers.authorization !== 'Bearer classroom-secret') {
          return send(401, { error: { status: 401, message: 'A valid bearer token is required' } }, { 'WWW-Authenticate': 'Bearer' });
        }
        return send(200, { message: 'Access granted!', data: { secret: 'You sent the correct token.' } });
      }
      if (path === '/users') {
        if (method === 'GET') {
          const search = (url.searchParams.get('search') || '').toLowerCase();
          const data = users.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(search));
          return send(200, { data, total: data.length });
        }
        if (method === 'POST') {
          const body = await readJson();
          const errors = validateUser(body);
          if (errors.length) return fail(400, 'Validation failed', errors);
          const user = { id: nextId++, name: body.name.trim(), email: body.email };
          users.push(user);
          return send(201, { data: user }, { Location: `/users/${user.id}` });
        }
        return methodNotAllowed(['GET', 'HEAD', 'POST']);
      }
      const match = path.match(/^\/users\/(\d+)$/);
      if (match) {
        if (!['GET', 'PUT', 'PATCH', 'DELETE'].includes(method)) return methodNotAllowed(['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE']);
        const index = users.findIndex(user => user.id === Number(match[1]));
        if (index < 0) return fail(404, 'User not found');
        if (method === 'GET') return send(200, { data: users[index] });
        if (method === 'DELETE') {
          users.splice(index, 1);
          return send(204);
        }
        const body = await readJson();
        const errors = validateUser(body, method === 'PATCH');
        if (errors.length) return fail(400, 'Validation failed', errors);
        users[index] = {
          ...users[index], ...body,
          ...(Object.hasOwn(body, 'name') ? { name: body.name.trim() } : {}),
        };
        return send(200, { data: users[index] });
      }
      return fail(404, 'Route not found');
    } catch (error) {
      if (!res.headersSent && !res.destroyed) {
        fail(error.status || 500, error.status ? error.message : 'Internal server error');
      }
    }
  };
}

function createServer() {
  return http.createServer(createHandler());
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const server = createServer();
  server.on('error', error => {
    console.error(`Could not start server: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, host, () => console.log(`Classroom mock API running at http://${host}:${port}\nImport classroom.postman_collection.json into Postman to get started.`));
}

module.exports = { createServer, createHandler };
