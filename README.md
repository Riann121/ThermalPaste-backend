# ThermalPaste-backend

Backend API for the ThermalPaste community platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Users
- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Login user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user

### Communities
- `GET /api/communities` - Get all communities
- `GET /api/communities/:groupId` - Get community by groupId
- `POST /api/communities` - Create community (authenticated)

### Posts
- `GET /api/posts/:id` - Get post by ID
- `POST /api/posts` - Create post (authenticated)
- `PUT /api/posts/:id/vote` - Vote on post (authenticated)

### Comments
- `GET /api/comments/:postId` - Get comments for a post
- `POST /api/comments/:postId` - Create comment (authenticated)

## Tech Stack

- Node.js
- Express
- MongoDB (Mongoose)
- JWT Authentication
- bcrypt
