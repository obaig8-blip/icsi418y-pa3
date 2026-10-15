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