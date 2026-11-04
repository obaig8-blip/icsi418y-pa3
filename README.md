# ICSI 418Y Programming Assignment 3

## Features

- Signup and login from PA2 still work.
- Create a project with a name, description, status, and Project Lead.
- Project Lead is selected from registered users.
- View all projects with the Project Lead's readable name/username.
- View the members of a selected project.
- Add registered users to projects.
- Remove non-lead members.
- Prevent duplicate memberships.
- Prevent the current Project Lead from being removed.
- The Project Lead is automatically added as a project member.

## MongoDB Collections

The app uses these collections in the database:

- `users` (existing collection from PA2)
- `Projects`
- `ProjectMemberships`
- `UserStories` (new in PA4)



### Backend

Open a terminal in the server folder:

```bash
npm install
npm start
```

The terminal should show `Connected to MongoDB` and `Server running on http://localhost:9000`.

### Frontend

Keep the server running. Open a second terminal in the client folder:

```bash
npm install
npm run dev
```

Open the Vite address shown in the terminal, usually `http://localhost:5173`.

## Testing for the PA3 Video

Before recording, create at least three registered users and two projects.

Recommended demonstration order:


 Create a project and choose one registered user as Project Lead.
 Create a second project with a Project Lead.
 Open View Projects and show both projects and their leads.
 Open Memberships and show that the Project Lead is already a member.
 Add another registered user to the first project.
 Add that same user to the second project to show a user can be in multiple projects.
 Try adding that same user to the same project again and show the duplicate-membership error.
 Remove a non-lead member.
 Show that the Project Lead cannot be removed.
 In MongoDB Atlas, show the `Projects` and `ProjectMemberships` collections.
 Briefly show `client/src/App.jsx`, `server/app.js`, and `server/server.js` and explain how the frontend calls the backend and how ObjectId references represent relationships.

## PA4: User Stories and Project Backlog

### Features

- Create a user story for a selected project with a title, description ("As a [type of user], I want [goal], so that [benefit]."), priority (High, Medium, Low), and assigned member or Unassigned.
- The backend gives every new story the status To Do. It can later be changed to In Progress or Done.
- The Backlog tab shows all stories in the selected project, including Done stories, with title, priority, status, and assigned member. Use View details to see the description. A message appears when a project has no stories.
- Switching projects shows only that project's stories and clears any open details or edit form.
- Edit a story's title, description, priority, status, and assigned member. Cancel leaves it unchanged.
- Delete a story after confirmation. Canceling the confirmation leaves it unchanged.
- The assignment dropdown lists only members of the selected project (including the Project Lead) plus Unassigned. The backend also checks that the assigned user exists and belongs to the project.
- A member cannot be removed while they still have stories assigned in that project, including Done stories. Stories in other projects do not block removal. The Project Lead still cannot be removed.

### UserStories fields

| Field | Stored value |
|---|---|
| `_id` | MongoDB-generated ObjectId |
| `project_id` | ObjectId reference to the Project |
| `title` | Nonblank string |
| `description` | Nonblank string containing the user story |
| `priority` | High, Medium, or Low |
| `status` | To Do, In Progress, or Done |
| `assigned_user_id` | ObjectId reference to a User, or null for Unassigned |

### Story API routes

- `GET /api/projects/:projectId/stories`: view a project's backlog
- `POST /api/projects/:projectId/stories`: create a story
- `PUT /api/projects/:projectId/stories/:storyId`: edit a story
- `DELETE /api/projects/:projectId/stories/:storyId`: delete a story

### Preparing PA4 Test Data

With `server/.env` set up, run this in the server folder:

```bash
npm run seed
```

This creates users `alice`, `ben`, `chloe`, and `dev` (password `password123`) and two projects:

- Campus Event Planner: lead alice; members chloe and dev
- Study Group Finder: lead ben; member dev (chloe is not a member)

It also adds six stories (three per project) covering all priorities and statuses, with both assigned and unassigned stories. Running it again resets only the stories in these two projects.

### Running the tests

```bash
cd server
npm test
```

### Testing for the PA4 Video

1. On Backlog, create a story in Campus Event Planner and assign it to chloe.
2. Switch to Study Group Finder. Only its stories appear, and chloe is not in the dropdown.
3. Edit a story, change its status, and reassign or unassign it.
4. Delete a story with confirmation, then refresh the page to show the change persisted.
5. Submit a story with a blank title to show validation.
6. On Memberships, try to remove chloe from Campus Event Planner to show the assigned-stories error.
7. In MongoDB Atlas, show the `UserStories` collection and its `project_id` and `assigned_user_id` ObjectIds.
8. Briefly show `client/src/App.jsx` and `server/app.js`, and explain how the frontend calls the story routes and how assignment and member-removal validation work.
