const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('./app');

test('signup and login handle the required outcomes', async () => {
  const records = new Map();
  const users = {
    async findOne({ username }) { return records.get(username) || null; },
    async insertOne(user) { records.set(user.username, user); }
  };

  const server = createApp(users).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function post(route, body) {
    const response = await fetch(`${base}/api/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: response.status, result: await response.json() };
  }

  try {
    const person = { firstName: 'Amina', lastName: 'Ali', username: 'amina', password: 'sample-pass' };
    assert.equal((await post('signup', { ...person, firstName: '' })).status, 400);
    assert.equal((await post('signup', person)).status, 201);
    assert.equal(records.get('amina').f_name, 'Amina');
    assert.notEqual(records.get('amina').password, person.password);
    assert.equal((await post('signup', person)).status, 409);
    assert.equal((await post('login', { username: '', password: '' })).status, 400);
    assert.equal((await post('login', { username: 'unknown', password: 'sample-pass' })).status, 401);
    assert.equal((await post('login', { username: 'amina', password: 'wrong' })).status, 401);
    assert.equal((await post('login', { username: 'amina', password: 'sample-pass' })).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('database failures return an understandable error', async () => {
  const users = { async findOne() { throw new Error('test database failure'); } };
  const server = createApp(users).listen(0);
  await new Promise(resolve => server.once('listening', resolve));

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'amina', password: 'sample-pass' })
    });
    assert.equal(response.status, 500);
    assert.match((await response.json()).message, /Server error/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
