# Bug Pilot

Bug Pilot is a full stack bug and feedback management app. Teams can create bug report forms, share them publicly, review incoming submissions, and track issues from one admin dashboard.

## What you can do

- Create and manage bug report forms
- Share a public feedback link with users
- Track bugs by status, severity, priority, type, and assignee
- Review and update submissions
- View dashboard analytics and project settings
- Sign in to the admin area with Firebase Authentication

## Planned: AI assisted bug investigation

Bug Pilot will support an MCP (Model Context Protocol) connection for AI assisted investigation. A developer will be able to give an AI agent the relevant bug details such as the report, reproduction steps, environment, logs, and related files so it can understand the issue, validate likely causes, and help investigate or implement a fix faster.

## Run locally

**Requirements:** Node.js 18+ and a MongoDB database (local or Atlas).

```bash
git clone <repository-url>
cd Bug_Pilot
npm install
cp .env.example .env
```

Update `.env` with your MongoDB connection string. The default setup uses:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/bugpilot
PORT=3001
VITE_API_URL=http://localhost:3001/api
```

Start the frontend and API together:

```bash
npm run dev
```

Open `http://localhost:5173`. The API health endpoint is available at `http://localhost:3001/api/health`.

## How to use it

1. Visit `/auth` and sign in or create an account.
2. Open the admin dashboard at `/admin`.
3. Create a bug report form in **Forms** and copy its public link.
4. Share the link with users; their reports arrive in **Submissions**.
5. Review, prioritize, assign, and update bugs from **Bugs**.
6. Open **Analytics** to view live bug counts, status/severity/category breakdowns, creation trends, and resolution metrics. Analytics reads the same MongoDB records as the Bugs dashboard through `GET /api/insights`.

## Useful commands

```bash
npm run dev          # Run frontend and backend
npm run dev:frontend # Run only Vite
npm run dev:server   # Run only the Express API
npm run build        # Create a production frontend build
npm run typecheck    # Check TypeScript types
```

## Tech stack

React, TypeScript, Vite, Express, MongoDB/Mongoose, Firebase Authentication, and Vercel.
