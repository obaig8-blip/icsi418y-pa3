require('dotenv').config();
const { MongoClient } = require('mongodb');
const createApp = require('./app');

async function start() {
  if (!process.env.MONGO_URI) {
    throw new Error('Set MONGO_URI in server/.env before starting the app.');
  }

  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  console.log('Connected to MongoDB');

  const database = client.db(process.env.DB_NAME || 'pa2_login_signup');
  const users = database.collection('users');
  const projects = database.collection('Projects');
  const memberships = database.collection('ProjectMemberships');

  await users.createIndex({ username: 1 }, { unique: true });
  await memberships.createIndex({ project_id: 1, user_id: 1 }, { unique: true });

  const port = Number(process.env.PORT) || 9000;
  createApp(users, projects, memberships).listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

start().catch(error => {
  console.error('Unable to start server:', error);
  process.exit(1);
});
