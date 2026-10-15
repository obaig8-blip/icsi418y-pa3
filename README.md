# ICSI 418Y Programming Assignment 3

This project extends Programming Assignment 2 by adding software projects and project memberships. It uses React for the frontend, Express/Node.js for the backend, and MongoDB Atlas for data storage.

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

`Projects.project_lead_id`, `ProjectMemberships.project_id`, and `ProjectMemberships.user_id` use MongoDB ObjectId references rather than copied usernames or project names.

## Setup

1. Install Node.js.
2. Set up or use your existing MongoDB Atlas cluster.
3. In Atlas, make sure your database user is active and your current IP address is allowed under Network Access.
4. In the `server` folder, copy `.env.example` to a file named `.env`.
5. Put your own MongoDB connection string in `MONGO_URI`. Do not commit `.env` to GitHub.
6. Keep `DB_NAME=pa2_login_signup` if you want to reuse the same PA2 users.

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

1. Show that Signup still works.
2. Show that Login still works.
3. Create a project and choose one registered user as Project Lead.
4. Create a second project with a Project Lead.
5. Open View Projects and show both projects and their leads.
6. Open Memberships and show that the Project Lead is already a member.
7. Add another registered user to the first project.
8. Add that same user to the second project to show a user can be in multiple projects.
9. Try adding that same user to the same project again and show the duplicate-membership error.
10. Remove a non-lead member.
11. Show that the Project Lead cannot be removed.
12. In MongoDB Atlas, show the `Projects` and `ProjectMemberships` collections.
13. Briefly show `client/src/App.jsx`, `server/app.js`, and `server/server.js` and explain how the frontend calls the backend and how ObjectId references represent relationships.

## Submission

Before submitting, test the application, commit the final changes, push them to GitHub, verify the newest files are present, and make sure `.env` and `node_modules` were not committed. Submit the GitHub repository URL and the Zoom video through Brightspace.
