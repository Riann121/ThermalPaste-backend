# ThermalPaste-backend

Backend REST API for the **ThermalPaste** community platform — a forum and discussion hub for PC builders, overclockers, and hardware enthusiasts.

---

## Tech Stack

- **Runtime:** Node.js (ES Modules, `"type": "module"`)
- **Framework:** Express 4.18
- **Database:** MongoDB via Mongoose 9.x
- **Authentication:** Dual JWT (15-min Access + 7-day Refresh tokens in HttpOnly cookies), bcryptjs
- **Logging:** Custom colored lifecycle logger via `colors`

---

## Setup & Running

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```env
PORT=4000
DATABASE_URL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
ALLOWED_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Seed Database (Optional)
Populate the database with realistic communities, test users, posts, and threaded comments:
```bash
npm run seed
```

### 5. Run Automated Tests
```bash
npm test
```

---

## API Routes Reference

Base URL: `http://localhost:4000`

### 1. Health
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Returns server health status, uptime, and timestamp. |

---

### 2. Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | None | Register a new user account with username, email, and password. |
| `POST` | `/api/auth/login` | None | Authenticate user and issue access and refresh tokens in HttpOnly cookies. |
| `POST` | `/api/auth/logout` | None | Clear authentication cookies and end user session. |
| `GET` | `/api/auth/me` | `checkToken` | Retrieve authenticated user's credentials and identity. |
| `POST` | `/api/auth/refresh` | Cookie | Rotate refresh token and issue a fresh access token. |

---

### 3. User Profile (`/api/profile`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/profile` | `checkToken` | Create a user profile with bio, avatar image, and preferences. |
| `GET` | `/api/profile` | `checkToken` | Fetch the current user's profile with populated joined communities. |
| `PUT` | `/api/profile` | `checkToken` | Update current user's bio, avatar link, or profile fields. |
| `DELETE`| `/api/profile` | `checkToken` | Delete current user's profile record. |

---

### 4. Communities / Groups (`/api/groups`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/groups` | `optionalToken` | List and search public groups (and private groups user belongs to) with `?search=` and `?category=` filters. |
| `POST` | `/api/groups` | `checkToken` | Create a new community; sets creator as the first member and syncs UserProfile. |
| `GET` | `/api/groups/:idOrName` | `optionalToken` | Get group details and member status by MongoDB `_id` or slug `name`. |
| `GET` | `/api/groups/:idOrName/posts` | `optionalToken` | Get paginated posts feed for a group (`?page=1&limit=10`), checking privacy. |
| `PATCH`| `/api/groups/:id` | `checkToken` | Update group tagline, description, branding, or privacy (creator only). |
| `POST` | `/api/groups/:id/join` | `checkToken` | Join a public group immediately or submit a join request for a private group. |
| `POST` | `/api/groups/:id/leave` | `checkToken` | Leave a group (creator cannot leave). |
| `GET` | `/api/groups/:id/requests` | `checkToken` | View pending join requests for a private group (creator only). |
| `PATCH`| `/api/groups/:id/requests/:userId` | `checkToken` | Accept or reject a private group join request (creator only). |

---

### 5. Posts (`/api/posts`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/posts` | `optionalToken` | Paginated cross-group main feed (`?page=1&limit=10&sort=new`) respecting privacy. |
| `POST` | `/api/posts` | `checkToken` | Create a post in a public group or a private group where user is a member (supports JSON or multipart/form-data with image). |
| `POST` | `/api/posts/image` | `checkToken` | Upload a post image directly to Cloudinary (`multipart/form-data` with `image`), returns `imageUrl`. |
| `POST` | `/api/posts/:id/image` | `checkToken` | Upload and set post image for an existing post (owner only). |
| `GET` | `/api/posts/:id` | `optionalToken` | Get post details by ID with populated author avatar, group, and comments count. |
| `PUT` | `/api/posts/:id` | `checkToken` | Edit post heading, description, or image (owner only; supports JSON or multipart/form-data with image). |
| `DELETE`| `/api/posts/:id` | `checkToken` | Delete post and cascade delete related comments, bookmarks, and votes (owner only). |
| `POST` | `/api/posts/:id/save` | `checkToken` | Toggle bookmark / saved status for the post. |
| `POST` | `/api/posts/:id/react`| `checkToken` | React to a post (`upvote` or `downvote`, toggleable, alias: `/vote`). Updates `reactCount`. |
| `GET`  | `/api/posts/:id/react`| `optionalToken` | Get reaction counts and current user's reaction status. |
| `GET` | `/api/posts/saved` | `checkToken` | Get user's saved posts feed with pagination (convenience alias for `/api/saved`). |
| `GET` | `/api/posts/:postId/comments` | `checkToken` | Fetch comments discussion tree for a post (convenience alias). |

---

### 6. Saved Posts (`/api/saved`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/saved` | `checkToken` | Paginated list of all posts saved/bookmarked by the authenticated user. |

---

### 7. Comments (`/api/comments`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/comments` | `checkToken` | Create a top-level comment or a nested reply to an existing comment. |
| `GET` | `/api/comments/posts/:postId/comments` | `checkToken` | Fetch all comments for a post structured as a recursive nested tree. |
| `PUT` | `/api/comments/:commentId` | `checkToken` | Edit comment text (owner only). |
| `DELETE`| `/api/comments/:commentId` | `checkToken` | Delete a comment and cascade delete all its nested replies (owner only). |
| `POST` | `/api/comments/:commentId/like` | `checkToken` | Toggle like/unlike on a comment. |
