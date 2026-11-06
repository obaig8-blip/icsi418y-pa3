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

## PA4: User Stories and Backlog

PA4 adds user stories to each project. A new Backlog tab lets you:

- Create a story with a title, description, priority, and assigned member (or Unassigned). New stories always start as To Do.
- View all stories for the selected project.
- Edit a story, including its status (To Do, In Progress, Done).
- Delete a story after confirming.

Only members of the project can be assigned to its stories. A member can't be removed from a project while they still have stories assigned in that project.

Stories are saved in a new `UserStories` collection with these fields: `project_id`, `title`, `description`, `priority`, `status`, and `assigned_user_id` (null if unassigned).

### Test Data

After setting up `server/.env`, run this in the server folder to add sample users, projects, and stories:

```bash
npm run seed
```

This creates users alice, ben, chloe, and dev (password: `password123`) and two projects, Campus Event Planner and Study Group Finder, with three stories each. chloe is only a member of Campus Event Planner.

### Tests

```bash
cd server
npm test
```
