const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

function validId(value) {
  return typeof value === 'string' && ObjectId.isValid(value);
}

function publicUser(user) {
  return {
    _id: user._id.toString(),
    firstName: user.f_name,
    lastName: user.l_name,
    username: user.username,
    displayName: `${user.f_name || ''} ${user.l_name || ''}`.trim() || user.username
  };
}

const STORY_PRIORITIES = ['High', 'Medium', 'Low'];
const STORY_STATUSES = ['To Do', 'In Progress', 'Done'];

function nonBlank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Convert a stored story into JSON that uses the same field names as MongoDB.
function publicStory(story, assignedUser) {
  return {
    _id: story._id.toString(),
    project_id: story.project_id.toString(),
    title: story.title,
    description: story.description,
    priority: story.priority,
    status: story.status,
    assigned_user_id: story.assigned_user_id ? story.assigned_user_id.toString() : null,
    assigned_user: assignedUser ? publicUser(assignedUser) : null
  };
}

function createApp(users, projects, memberships, userStories) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({ message: 'Server is running' });
  });

  // PA2 signup route
  app.post('/api/signup', async (req, res) => {
    const { firstName, lastName, username, password } = req.body || {};

    if (![firstName, lastName, username, password].every(
      value => typeof value === 'string' && value.trim()
    )) {
      return res.status(400).json({ message: 'Please fill in every signup field.' });
    }

    const cleanUsername = username.trim();

    try {
      const existingUser = await users.findOne({ username: cleanUsername });
      if (existingUser) {
        return res.status(409).json({ message: 'That username is already taken.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await users.insertOne({
        f_name: firstName.trim(),
        l_name: lastName.trim(),
        username: cleanUsername,
        password: hashedPassword
      });

      return res.status(201).json({ message: 'Account created. You can log in now.' });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'That username is already taken.' });
      }
      console.error('Signup error:', error);
      return res.status(500).json({ message: 'Server error. Please try again later.' });
    }
  });

  // PA2 login route
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body || {};

    if (![username, password].every(value => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ message: 'Please enter your username and password.' });
    }

    try {
      const user = await users.findOne({ username: username.trim() });
      if (!user) {
        return res.status(401).json({ message: 'Username not found.' });
      }

      const passwordMatches = await bcrypt.compare(password, user.password);
      if (!passwordMatches) {
        return res.status(401).json({ message: 'Incorrect password.' });
      }

      return res.json({ message: `Login successful. Welcome, ${user.f_name}!` });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: 'Server error. Please try again later.' });
    }
  });

  // Registered users are used for project leads and project members.
  app.get('/api/users', async (req, res) => {
    try {
      const userList = await users.find({}).sort({ username: 1 }).toArray();
      return res.json(userList.map(publicUser));
    } catch (error) {
      console.error('Get users error:', error);
      return res.status(500).json({ message: 'Could not load users.' });
    }
  });

  // Create a project and automatically add the project lead as a member.
  app.post('/api/projects', async (req, res) => {
    const { name, description, status, projectLeadId } = req.body || {};
    const allowedStatuses = ['Planning', 'Active', 'Completed'];

    if (![name, description, status, projectLeadId].every(
      value => typeof value === 'string' && value.trim()
    )) {
      return res.status(400).json({ message: 'Please fill in every project field.' });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Please choose a valid project status.' });
    }

    if (!validId(projectLeadId)) {
      return res.status(404).json({ message: 'The selected Project Lead does not exist.' });
    }

    const leadId = new ObjectId(projectLeadId);

    try {
      const lead = await users.findOne({ _id: leadId });
      if (!lead) {
        return res.status(404).json({ message: 'The selected Project Lead does not exist.' });
      }

      const project = {
        name: name.trim(),
        description: description.trim(),
        status,
        project_lead_id: leadId
      };

      const result = await projects.insertOne(project);

      try {
        await memberships.insertOne({
          project_id: result.insertedId,
          user_id: leadId
        });
      } catch (membershipError) {
        // Avoid leaving a project without its required lead membership.
        await projects.deleteOne({ _id: result.insertedId });
        throw membershipError;
      }

      return res.status(201).json({
        message: 'Project created successfully. The Project Lead was added as a member.',
        projectId: result.insertedId.toString()
      });
    } catch (error) {
      console.error('Create project error:', error);
      return res.status(500).json({ message: 'Could not create the project.' });
    }
  });

  // Return projects with a readable project lead instead of only an ObjectId.
  app.get('/api/projects', async (req, res) => {
    try {
      const projectList = await projects.find({}).sort({ name: 1 }).toArray();
      const response = [];

      for (const project of projectList) {
        const lead = await users.findOne({ _id: project.project_lead_id });
        response.push({
          _id: project._id.toString(),
          name: project.name,
          description: project.description,
          status: project.status,
          projectLeadId: project.project_lead_id.toString(),
          projectLead: lead ? publicUser(lead) : null
        });
      }

      return res.json(response);
    } catch (error) {
      console.error('Get projects error:', error);
      return res.status(500).json({ message: 'Could not load projects.' });
    }
  });

  // View all members of one project.
  app.get('/api/projects/:projectId/members', async (req, res) => {
    const { projectId } = req.params;

    if (!validId(projectId)) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    const id = new ObjectId(projectId);

    try {
      const project = await projects.findOne({ _id: id });
      if (!project) {
        return res.status(404).json({ message: 'Project not found.' });
      }

      const membershipList = await memberships.find({ project_id: id }).toArray();
      const memberList = [];

      for (const membership of membershipList) {
        const user = await users.findOne({ _id: membership.user_id });
        if (user) {
          memberList.push({
            ...publicUser(user),
            isLead: user._id.toString() === project.project_lead_id.toString()
          });
        }
      }

      return res.json(memberList);
    } catch (error) {
      console.error('Get members error:', error);
      return res.status(500).json({ message: 'Could not load project members.' });
    }
  });

  // Add a registered user to a project.
  app.post('/api/projects/:projectId/members', async (req, res) => {
    const { projectId } = req.params;
    const { userId } = req.body || {};

    if (!validId(projectId)) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    if (!validId(userId)) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const projectObjectId = new ObjectId(projectId);
    const userObjectId = new ObjectId(userId);

    try {
      const project = await projects.findOne({ _id: projectObjectId });
      if (!project) {
        return res.status(404).json({ message: 'Project not found.' });
      }

      const user = await users.findOne({ _id: userObjectId });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const existingMembership = await memberships.findOne({
        project_id: projectObjectId,
        user_id: userObjectId
      });

      if (existingMembership) {
        return res.status(409).json({ message: 'That user is already a member of this project.' });
      }

      await memberships.insertOne({
        project_id: projectObjectId,
        user_id: userObjectId
      });

      return res.status(201).json({ message: `${user.username} was added to the project.` });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'That user is already a member of this project.' });
      }
      console.error('Add member error:', error);
      return res.status(500).json({ message: 'Could not add the project member.' });
    }
  });

  // Remove a member, except for the current project lead.
  app.delete('/api/projects/:projectId/members/:userId', async (req, res) => {
    const { projectId, userId } = req.params;

    if (!validId(projectId)) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    if (!validId(userId)) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const projectObjectId = new ObjectId(projectId);
    const userObjectId = new ObjectId(userId);

    try {
      const project = await projects.findOne({ _id: projectObjectId });
      if (!project) {
        return res.status(404).json({ message: 'Project not found.' });
      }

      const user = await users.findOne({ _id: userObjectId });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      if (project.project_lead_id.toString() === userObjectId.toString()) {
        return res.status(400).json({ message: 'The current Project Lead cannot be removed.' });
      }

      // PA4: a member who still has stories in THIS project cannot be removed.
      // Stories in other projects do not block removal from this project.
      const assignedCount = await userStories.countDocuments({
        project_id: projectObjectId,
        assigned_user_id: userObjectId
      });

      if (assignedCount > 0) {
        return res.status(409).json({
          message: `${user.username} still has ${assignedCount} user ${assignedCount === 1 ? 'story' : 'stories'} assigned in this project (including Done stories). Reassign, unassign, or delete ${assignedCount === 1 ? 'it' : 'them'} before removing this member.`
        });
      }

      const result = await memberships.deleteOne({
        project_id: projectObjectId,
        user_id: userObjectId
      });

      if (!result.deletedCount) {
        return res.status(404).json({ message: 'That user is not a member of this project.' });
      }

      return res.json({ message: `${user.username} was removed from the project.` });
    } catch (error) {
      console.error('Remove member error:', error);
      return res.status(500).json({ message: 'Could not remove the project member.' });
    }
  });

  // ---------------------------------------------------------------
  // PA4: User stories and project backlog
  // ---------------------------------------------------------------

  // Look up the project in the URL. Sends the error response and returns null when invalid.
  async function findProjectOr404(projectId, res) {
    if (!validId(projectId)) {
      res.status(400).json({ message: 'Invalid project ID.' });
      return null;
    }
    const project = await projects.findOne({ _id: new ObjectId(projectId) });
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return null;
    }
    return project;
  }

  // Returns { value } with an ObjectId (or null for Unassigned), or { error }.
  async function resolveAssignment(rawValue, project) {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return { value: null };
    }
    if (!validId(rawValue)) {
      return { status: 400, error: 'The assigned member ID is not valid.' };
    }

    const userId = new ObjectId(rawValue);
    const user = await users.findOne({ _id: userId });
    if (!user) {
      return { status: 404, error: 'The assigned user does not exist.' };
    }

    const membership = await memberships.findOne({ project_id: project._id, user_id: userId });
    if (!membership) {
      return { status: 400, error: `${user.username} is not a member of this project, so the story cannot be assigned to them.` };
    }

    return { value: userId };
  }

  // Shared validation for the text and priority fields.
  function validateStoryFields({ title, description, priority }) {
    if (!nonBlank(title)) return 'Title is required.';
    if (!nonBlank(description)) return 'Description is required.';
    if (!nonBlank(priority)) return 'Priority is required.';
    if (!STORY_PRIORITIES.includes(priority)) return 'Priority must be High, Medium, or Low.';
    return null;
  }

  async function storyResponse(story) {
    const assignedUser = story.assigned_user_id
      ? await users.findOne({ _id: story.assigned_user_id })
      : null;
    return publicStory(story, assignedUser);
  }

  // View the backlog (all statuses) for one project.
  app.get('/api/projects/:projectId/stories', async (req, res) => {
    try {
      const project = await findProjectOr404(req.params.projectId, res);
      if (!project) return;

      const storyList = await userStories.find({ project_id: project._id }).sort({ _id: 1 }).toArray();
      const response = [];
      for (const story of storyList) {
        response.push(await storyResponse(story));
      }
      return res.json(response);
    } catch (error) {
      console.error('Get stories error:', error);
      return res.status(500).json({ message: 'Could not load user stories.' });
    }
  });

  // Create a story. The backend always sets the status to To Do.
  app.post('/api/projects/:projectId/stories', async (req, res) => {
    const body = req.body || {};

    try {
      const project = await findProjectOr404(req.params.projectId, res);
      if (!project) return;

      const fieldError = validateStoryFields(body);
      if (fieldError) return res.status(400).json({ message: fieldError });

      const assignment = await resolveAssignment(body.assigned_user_id, project);
      if (assignment.error) return res.status(assignment.status).json({ message: assignment.error });

      const story = {
        project_id: project._id,
        title: body.title.trim(),
        description: body.description.trim(),
        priority: body.priority,
        status: 'To Do',
        assigned_user_id: assignment.value
      };

      const result = await userStories.insertOne(story);
      story._id = result.insertedId;

      return res.status(201).json({
        message: 'User story created with status To Do.',
        story: await storyResponse(story)
      });
    } catch (error) {
      console.error('Create story error:', error);
      return res.status(500).json({ message: 'Could not create the user story.' });
    }
  });

  // Edit a story. The filter uses BOTH the story id and the project id, so an
  // update can only target a story that belongs to the project in the URL.
  app.put('/api/projects/:projectId/stories/:storyId', async (req, res) => {
    const body = req.body || {};
    const { storyId } = req.params;

    try {
      const project = await findProjectOr404(req.params.projectId, res);
      if (!project) return;

      if (!validId(storyId)) {
        return res.status(400).json({ message: 'Invalid story ID.' });
      }
      const storyObjectId = new ObjectId(storyId);

      const existing = await userStories.findOne({ _id: storyObjectId, project_id: project._id });
      if (!existing) {
        return res.status(404).json({ message: 'User story not found in this project.' });
      }

      if (body.project_id !== undefined && String(body.project_id) !== project._id.toString()) {
        return res.status(400).json({ message: 'A story cannot be moved to a different project.' });
      }

      const fieldError = validateStoryFields(body);
      if (fieldError) return res.status(400).json({ message: fieldError });

      if (!STORY_STATUSES.includes(body.status)) {
        return res.status(400).json({ message: 'Status must be To Do, In Progress, or Done.' });
      }

      const assignment = await resolveAssignment(body.assigned_user_id, project);
      if (assignment.error) return res.status(assignment.status).json({ message: assignment.error });

      const updates = {
        title: body.title.trim(),
        description: body.description.trim(),
        priority: body.priority,
        status: body.status,
        assigned_user_id: assignment.value
      };

      // project_id is deliberately not in $set, so it never changes.
      await userStories.updateOne({ _id: storyObjectId, project_id: project._id }, { $set: updates });

      return res.json({
        message: 'User story updated.',
        story: await storyResponse({ ...existing, ...updates })
      });
    } catch (error) {
      console.error('Update story error:', error);
      return res.status(500).json({ message: 'Could not update the user story.' });
    }
  });

  // Delete a story (the frontend asks for confirmation first).
  app.delete('/api/projects/:projectId/stories/:storyId', async (req, res) => {
    const { storyId } = req.params;

    try {
      const project = await findProjectOr404(req.params.projectId, res);
      if (!project) return;

      if (!validId(storyId)) {
        return res.status(400).json({ message: 'Invalid story ID.' });
      }

      const result = await userStories.deleteOne({ _id: new ObjectId(storyId), project_id: project._id });
      if (!result.deletedCount) {
        return res.status(404).json({ message: 'User story not found in this project.' });
      }

      return res.json({ message: 'User story deleted.' });
    } catch (error) {
      console.error('Delete story error:', error);
      return res.status(500).json({ message: 'Could not delete the user story.' });
    }
  });

  return app;
}

module.exports = createApp;
module.exports.STORY_PRIORITIES = STORY_PRIORITIES;
module.exports.STORY_STATUSES = STORY_STATUSES;
