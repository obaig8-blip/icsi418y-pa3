const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const createApp = require('./app');

// Minimal in-memory stand-in for a MongoDB collection (equality filters only).
function fakeCollection(docs = []) {
  const same = (a, b) => (a === null || a === undefined || b === null || b === undefined)
    ? (a ?? null) === (b ?? null)
    : String(a) === String(b);
  const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => {
    if (value && value.$in) return value.$in.some(item => same(doc[key], item));
    return same(doc[key], value);
  });
  return {
    docs,
    async findOne(filter) { return docs.find(doc => matches(doc, filter)) || null; },
    find(filter) {
      const result = docs.filter(doc => matches(doc, filter));
      return { sort() { return this; }, async toArray() { return result; } };
    },
    async insertOne(doc) { const _id = new ObjectId(); docs.push({ ...doc, _id }); return { insertedId: _id }; },
    async updateOne(filter, update) {
      const doc = docs.find(item => matches(item, filter));
      if (doc) Object.assign(doc, update.$set);
      return { matchedCount: doc ? 1 : 0 };
    },
    async deleteOne(filter) {
      const index = docs.findIndex(doc => matches(doc, filter));
      if (index >= 0) docs.splice(index, 1);
      return { deletedCount: index >= 0 ? 1 : 0 };
    },
    async countDocuments(filter) { return docs.filter(doc => matches(doc, filter)).length; }
  };
}

async function setup() {
  const alice = new ObjectId(), chloe = new ObjectId(), ben = new ObjectId(), outsider = new ObjectId();
  const p1 = new ObjectId(), p2 = new ObjectId();
  const users = fakeCollection([
    { _id: alice, f_name: 'Alice', l_name: 'N', username: 'alice' },
    { _id: chloe, f_name: 'Chloe', l_name: 'D', username: 'chloe' },
    { _id: ben, f_name: 'Ben', l_name: 'C', username: 'ben' },
    { _id: outsider, f_name: 'Olu', l_name: 'X', username: 'olu' }
  ]);
  const projects = fakeCollection([
    { _id: p1, name: 'P1', description: 'd', status: 'Active', project_lead_id: alice },
    { _id: p2, name: 'P2', description: 'd', status: 'Planning', project_lead_id: ben }
  ]);
  const memberships = fakeCollection([
    { _id: new ObjectId(), project_id: p1, user_id: alice },
    { _id: new ObjectId(), project_id: p1, user_id: chloe },
    { _id: new ObjectId(), project_id: p2, user_id: ben },
    { _id: new ObjectId(), project_id: p2, user_id: chloe }
  ]);
  const stories = fakeCollection();

  const server = createApp(users, projects, memberships, stories).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function call(method, route, body) {
    const response = await fetch(base + route, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, data: await response.json() };
  }

  return { ids: { alice, chloe, ben, outsider, p1, p2 }, stories, call, close: () => new Promise(r => server.close(r)) };
}

const valid = { title: 'View event', description: 'As a student, I want X, so that Y.', priority: 'High' };

test('create story: always To Do, validation, and assignment rules', async () => {
  const { ids, stories, call, close } = await setup();
  try {
    const created = await call('POST', `/projects/${ids.p1}/stories`, { ...valid, status: 'Done', assigned_user_id: String(ids.chloe) });
    assert.equal(created.status, 201);
    assert.equal(created.data.story.status, 'To Do');
    assert.equal(created.data.story.assigned_user.username, 'chloe');
    assert.ok(stories.docs[0].project_id instanceof ObjectId);
    assert.ok(stories.docs[0].assigned_user_id instanceof ObjectId);

    assert.equal((await call('POST', `/projects/${ids.p1}/stories`, { ...valid, assigned_user_id: null })).data.story.assigned_user_id, null);
    assert.equal((await call('POST', `/projects/${ids.p1}/stories`, { ...valid, title: '   ' })).status, 400);
    assert.equal((await call('POST', `/projects/${ids.p1}/stories`, { ...valid, description: '' })).status, 400);
    assert.equal((await call('POST', `/projects/${ids.p1}/stories`, { ...valid, priority: 'Urgent' })).status, 400);
    assert.equal((await call('POST', `/projects/${ids.p1}/stories`, { ...valid, assigned_user_id: 'abc' })).status, 400);
    assert.equal((await call('POST', `/projects/${ids.p1}/stories`, { ...valid, assigned_user_id: String(new ObjectId()) })).status, 404);
    // ben is a member of P2 only, so he cannot be assigned in P1.
    assert.equal((await call('POST', `/projects/${ids.p1}/stories`, { ...valid, assigned_user_id: String(ids.ben) })).status, 400);
    assert.equal((await call('POST', `/projects/${ids.p2}/stories`, { ...valid, assigned_user_id: String(ids.ben) })).status, 201);
    assert.equal((await call('POST', `/projects/not-an-id/stories`, valid)).status, 400);
    assert.equal((await call('POST', `/projects/${new ObjectId()}/stories`, valid)).status, 404);

    const p1List = await call('GET', `/projects/${ids.p1}/stories`);
    assert.equal(p1List.data.length, 2);
    assert.ok(p1List.data.every(story => story.project_id === String(ids.p1)));
  } finally { await close(); }
});

test('edit and delete stay inside the story\'s own project', async () => {
  const { ids, stories, call, close } = await setup();
  try {
    const { data } = await call('POST', `/projects/${ids.p1}/stories`, valid);
    const id = data.story._id;
    const edit = { ...valid, title: 'Renamed', status: 'Done', assigned_user_id: String(ids.alice) };

    const updated = await call('PUT', `/projects/${ids.p1}/stories/${id}`, edit);
    assert.equal(updated.status, 200);
    assert.equal(stories.docs[0].status, 'Done');
    assert.equal(stories.docs[0].title, 'Renamed');

    // Reopen Done -> To Do and unassign.
    assert.equal((await call('PUT', `/projects/${ids.p1}/stories/${id}`, { ...edit, status: 'To Do', assigned_user_id: null })).status, 200);
    assert.equal(stories.docs[0].assigned_user_id, null);

    assert.equal((await call('PUT', `/projects/${ids.p1}/stories/${id}`, { ...edit, status: 'Blocked' })).status, 400);
    assert.equal((await call('PUT', `/projects/${ids.p1}/stories/${id}`, { ...edit, project_id: String(ids.p2) })).status, 400);
    assert.equal((await call('PUT', `/projects/${ids.p2}/stories/${id}`, edit)).status, 404);
    assert.equal((await call('PUT', `/projects/${ids.p1}/stories/bad`, edit)).status, 400);
    assert.equal(String(stories.docs[0].project_id), String(ids.p1));

    assert.equal((await call('DELETE', `/projects/${ids.p2}/stories/${id}`)).status, 404);
    assert.equal((await call('DELETE', `/projects/${ids.p1}/stories/${id}`)).status, 200);
    assert.equal(stories.docs.length, 0);
    assert.equal((await call('DELETE', `/projects/${ids.p1}/stories/${id}`)).status, 404);
  } finally { await close(); }
});

test('member removal is blocked only by stories in the same project', async () => {
  const { ids, call, close } = await setup();
  try {
    // chloe is in both projects; give her a Done story in P2 only.
    const { data } = await call('POST', `/projects/${ids.p2}/stories`, { ...valid, assigned_user_id: String(ids.chloe) });
    await call('PUT', `/projects/${ids.p2}/stories/${data.story._id}`, { ...valid, status: 'Done', assigned_user_id: String(ids.chloe) });

    const blocked = await call('DELETE', `/projects/${ids.p2}/members/${ids.chloe}`);
    assert.equal(blocked.status, 409);
    assert.match(blocked.data.message, /reassign, unassign, or delete/i);

    // Her P2 story does not block removal from P1.
    assert.equal((await call('DELETE', `/projects/${ids.p1}/members/${ids.chloe}`)).status, 200);

    // After unassigning, removal from P2 works.
    await call('PUT', `/projects/${ids.p2}/stories/${data.story._id}`, { ...valid, status: 'Done', assigned_user_id: null });
    assert.equal((await call('DELETE', `/projects/${ids.p2}/members/${ids.chloe}`)).status, 200);

    // The Project Lead still cannot be removed.
    assert.equal((await call('DELETE', `/projects/${ids.p1}/members/${ids.alice}`)).status, 400);
  } finally { await close(); }
});
