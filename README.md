# ThermalPaste-backend

Backend API for the ThermalPaste community platform.

## Architecture (MVP / Layered)

The `/health` route is split across the MVP layers:

```
src/
├── services/      # Model/Logic  - healthService.js
├── controllers/   # Presenter    - healthController.js
├── routes/        # View         - healthRoutes.js
├── middleware/    # logger
├── util/          # response helpers
└── app.js         # App assembly (wires routes + middleware)
server.js          # Entry point (starts server)
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file:

```
PORT=4000
```

3. Start the development server:

```bash
npm run dev
```

## Health Check

- `GET /health` - Returns server status, uptime, and timestamp

## Tech Stack

- Node.js
- Express
