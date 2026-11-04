// Prepares PA4 test data: 4 users, 2 projects, memberships, and 6 user stories.
// Run from the server folder with:  npm run seed
// Safe to run more than once: it reuses the seed users/projects and replaces
// only the stories that belong to the two seed projects.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

const PASSWORD = 'password123';

const seedUsers = [
  { f_name: 'Alice', l_name: 'Nguyen', username: 'alice' },
  { f_name: 'Ben', l_name: 'Carter', username: 'ben' },
  { f_name: 'Chloe', l_name: 'Diaz', username: 'chloe' },
  { f_name: 'Dev', l_name: 'Patel', username: 'dev' }
];

async function seed() {
  if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI in server/.env first.');

  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'pa2_login_signup');
  const users = db.collection('users');
  const projects = db.collection('Projects');
  const memberships = db.collection('ProjectMemberships');
  const userStories = db.collection('UserStories');

  try {
    const hashed = await bcrypt.hash(PASSWORD, 10);
    const ids = {};
    for (const user of seedUsers) {
      await users.updateOne(
        { username: user.username },
        { $setOnInsert: { ...user, password: hashed } },
        { upsert: true }
      );
      ids[user.username] = (await users.findOne({ username: user.username }))._id;
    }

    async function upsertProject(name, description, status, leadId) {
      await projects.updateOne(
        { name },
        { $set: { description, status, project_lead_id: leadId } },
        { upsert: true }
      );
      return (await projects.findOne({ name }))._id;
    }

    const planner = await upsertProject(
      'Campus Event Planner',
      'A web app where students can find and RSVP to campus events.',
      'Active',
      ids.alice
    );
    const tutor = await upsertProject(
      'Study Group Finder',
      'Helps students form study groups for their courses.',
      'Planning',
      ids.ben
    );

    async function addMember(projectId, userId) {
      await memberships.updateOne(
        { project_id: projectId, user_id: userId },
        { $setOnInsert: { project_id: projectId, user_id: userId } },
        { upsert: true }
      );
    }

    // Campus Event Planner: alice (lead), chloe, dev
    // Study Group Finder:   ben (lead), dev
    // chloe belongs to Campus Event Planner only.
    await addMember(planner, ids.alice);
    await addMember(planner, ids.chloe);
    await addMember(planner, ids.dev);
    await addMember(tutor, ids.ben);
    await addMember(tutor, ids.dev);

    await userStories.deleteMany({ project_id: { $in: [planner, tutor] } });
    await userStories.insertMany([
      {
        project_id: planner,
        title: 'View campus event details',
        description: 'As a student, I want to view details of a campus event, so that I can decide whether to attend.',
        priority: 'High',
        status: 'In Progress',
        assigned_user_id: ids.chloe
      },
      {
        project_id: planner,
        title: 'RSVP to an event',
        description: 'As a student, I want to RSVP to an event, so that the organizer knows how many people are coming.',
        priority: 'Medium',
        status: 'To Do',
        assigned_user_id: null
      },
      {
        project_id: planner,
        title: 'Post a new event',
        description: 'As a club officer, I want to post a new event, so that students can discover it.',
        priority: 'High',
        status: 'Done',
        assigned_user_id: ids.alice
      },
      {
        project_id: tutor,
        title: 'Search groups by course',
        description: 'As a student, I want to search study groups by course code, so that I can find classmates to study with.',
        priority: 'High',
        status: 'To Do',
        assigned_user_id: ids.dev
      },
      {
        project_id: tutor,
        title: 'Create a study group',
        description: 'As a student, I want to create a study group, so that others in my course can join it.',
        priority: 'Medium',
        status: 'In Progress',
        assigned_user_id: ids.ben
      },
      {
        project_id: tutor,
        title: 'Set meeting reminders',
        description: 'As a group member, I want reminders before a session, so that I do not miss it.',
        priority: 'Low',
        status: 'Done',
        assigned_user_id: null
      }
    ]);

    console.log('Seed data ready.');
    console.log(`Users (password "${PASSWORD}"): ${seedUsers.map(u => u.username).join(', ')}`);
    console.log('Projects: Campus Event Planner (lead alice; members chloe, dev)');
    console.log('          Study Group Finder (lead ben; member dev)');
    console.log('Stories: 3 per project, covering every priority and status, assigned and unassigned.');
  } finally {
    await client.close();
  }
}

seed().catch(error => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
