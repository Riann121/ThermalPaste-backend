# ThermalPaste Backend — Auth + Data Model Plan

Context: Express + MongoDB/Mongoose + JWT. `authController.js`, `authHelper.js`,
`checkToken.js`, and `authRouter.js` already exist and cover register/login/
logout with a single JWT cookie. There is no refresh token, no `/me` route,
and the existing `/logout` route has a bug (see Phase 3). Only a `User`
model exists so far; the app needs several more models before the rest of
the feature set (posts, comments, groups) can be built on top of a working
auth flow. This plan closes those gaps, phase by phase.

**Rule for the coding agent: only work on one phase per session. Do not start
the next phase until the current one is checked off and manually verified.**

---

## Phase 0 — Audit current code ✅ done

**Goal:** Get an accurate map of what exists before touching anything.

- [x] List all existing auth-related files (controllers, routes, middleware,
      models) and their current responsibilities.
  - `controllers/authController.js` — `register`, `login`, `logout`.
  - `middleware/checkToken.js` — verifies the JWT cookie, sets `req.user`.
  - `routes/authRouter.js` — wires up `POST /login`, `POST /register`,
    `POST /logout` (the last one behind `checkToken`).
  - `util/authHelper.js` — `COOKIE_OPTIONS` and `generateToken()`.
  - `models/Users.js` — the `User` schema (username, email, password only).
- [x] Confirm: where is the access token signed? What secret/env var? What
      expiry? — `generateToken()` in `authHelper.js`, signed with
      `process.env.JWT_SECRET`, `expiresIn: "7d"`. There is only **one**
      token today; it's being used the way an access token would be, but
      with a refresh-token-length expiry (see Phase 2).
- [x] Confirm: how is the cookie currently set (name, options: httpOnly,
      secure, sameSite, path, maxAge)? — cookie name `"token"`, `httpOnly:
      true`, `secure: false` (hardcoded, not env-gated — flagged in Phase
      4), `sameSite: "lax"`, `path: "/"`, **no `maxAge`/`expires` set**, so
      it behaves as a session cookie in the browser even though the JWT
      inside it is valid for 7 days (flagged in Phase 6).
- [x] Confirm: current CORS config — origin value, is `credentials: true`
      set? — confirmed in `src/app.js`: `cors({ credentials: true, origin: process.env.ALLOWED_ORIGIN })`.
      In `.env`, `ALLOWED_ORIGIN=http://localhost:5173`. Credentials are enabled and
      the origin is explicitly configured for the frontend.
- [x] Confirm: does a JWT-verify middleware already exist, and which routes
      use it? — `checkToken.js` exists and is generic/reusable, but is
      currently only applied to `POST /logout`, which is itself a bug (see
      Phase 3).
- [x] Note on route mounting: In `src/app.js`, auth routes are mounted directly
      at root (`app.use(authRoutes)`), meaning endpoints are currently
      `POST /login`, `POST /register`, `POST /logout` rather than under
      an `/api/auth` prefix.

**Output:** Captured above — all audit checks completed and verified against the live codebase.

---

## Phase 1 — Data models ✅ done

**Goal:** Get every Mongoose schema the app needs in place before building
routes on top of them. Do this before restructuring the token setup in
Phase 2, so the `User` model only needs to be touched once.

Decisions made:
- **Refresh token strategy:** Stateful via `tokenVersion: { type: Number, default: 0 }` on `User`. Simple, clean, and allows instant session invalidation / logout-everywhere.
- **UserProfile ID:** Dropped redundant `uuid`; MongoDB's standard `_id` is used.
- **Saved posts:** Implemented as a separate `SavedPost` collection with compound unique index `(user, post)` to prevent unbounded array growth on `User`.
- **Votes:** Implemented as a separate `Vote` model with compound unique index `(user, targetType, targetId)`.
- **Comments & Group posts:** Kept unbounded post/comment arrays off `Group` and `Post` in favor of indexed reference queries.

### 1.1 — Update `User`

- [x] Add refresh-token field:
  - [x] `tokenVersion: { type: Number, default: 0 }` (bump on logout/refresh rotation to invalidate old refresh tokens).
- [x] Confirm `password` is never returned by default (`select: false`): Added `select: false` to `password` in `models/Users.js`, and updated `authController.js`'s `login` to explicitly request `.select("+password")` so `bcrypt.compare` continues to work.

### 1.2 — `UserProfile`

- [x] `user` — `ObjectId`, ref `User`, `required`, `unique`.
- [x] `imageLink` — `String`.
- [x] Dropped `uuid` — MongoDB's `_id` handles unique identification.
- [x] `timestamps: true`.

### 1.3 — `Group`

- [x] `name` — `String`, `required`, `unique`.
- [x] `groupIconLink` — `String`.
- [x] `bannerLink` — `String`.
- [x] `description` — `String`.
- [x] `members` — `[{ type: ObjectId, ref: 'User' }]`.
- [x] Posts array omitted from `Group` document (queried by reference on `Post`).
- [x] `timestamps: true`.

### 1.4 — `Post`

- [x] `user` — `ObjectId`, ref `User`, `required`.
- [x] `group` — `ObjectId`, ref `Group`, `required`.
- [x] `heading` — `String`, `required`.
- [x] `description` — `String`.
- [x] `imageLink` — `String`.
- [x] Comment IDs array omitted from `Post` (queried by reference on `Comment`).
- [x] Raw `likeCount` omitted; derived dynamically from `Vote`.
- [x] `timestamps: true`.

### 1.5 — `Comment`

- [x] `user` — `ObjectId`, ref `User`, `required`.
- [x] `post` — `ObjectId`, ref `Post`, `required`.
- [x] `parentComment` — `ObjectId`, ref `Comment`, default `null`.
- [x] `comment` — `String`, `required`.
- [x] Raw `likeCount` omitted; derived from `Vote`.
- [x] `timestamps: true`.

### 1.6 — `Vote`

- [x] `user` — `ObjectId`, ref `User`, `required`.
- [x] `targetType` — `String`, `enum: ['Post', 'Comment']`, `required`.
- [x] `targetId` — `ObjectId`, `required`, refPath: `'targetType'`.
- [x] `value` — `Number`, `enum: [1, -1]`, `required`.
- [x] Compound unique index on `(user, targetType, targetId)`.
- [x] `timestamps: true`.

### 1.7 — `SavedPost`

- [x] `user` — `ObjectId`, ref `User`, `required`.
- [x] `post` — `ObjectId`, ref `Post`, `required`.
- [x] Compound unique index on `(user, post)`.
- [x] `timestamps: true`.

**Acceptance check:** ✅ Passed. All models were created and verified in MongoDB via `src/tests/models.test.js`, testing creation, population, compound unique indexes, and `select: false` behavior.

---

## Phase 2 — Split the single token into access + refresh

**Goal:** Right now `generateToken()` produces one JWT with a 7-day expiry,
and both `register`/`login` set it as the only cookie (`"token"`). That's
functioning as a long-lived session token, not an access+refresh pair.
Restructure it into two tokens with two different jobs.

- [ ] In `authHelper.js`:
  - [ ] Rename the existing `generateToken()` to something like
        `generateAccessToken()` and shorten its `expiresIn` to something
        short-lived (e.g. `"15m"`).
  - [ ] Add `generateRefreshToken(user)`, signed with a **separate** secret
        (`process.env.JWT_REFRESH_SECRET`, new env var), `expiresIn: "7d"`
        (this is where your current 7-day expiry effectively moves to).
  - [ ] Add a second cookie options object, e.g. `REFRESH_COOKIE_OPTIONS`,
        same shape as `COOKIE_OPTIONS` but with `path: "/api/auth/refresh"`
        so the refresh cookie isn't sent on every request, only when
        actually refreshing.
- [ ] In `authController.js`, in both `register` and `login`:
  - [ ] Rename the cookie currently set from `res.cookie("token", ...)` to
        `res.cookie("accessToken", token, COOKIE_OPTIONS)`.
  - [ ] Also call `generateRefreshToken(user)` and set it via
        `res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS)`.
  - [ ] Stop returning the raw `token` value in the JSON response body (see
        Phase 6 — the frontend doesn't need it since it never reads the
        cookie directly; returning it in the body is an unnecessary
        exposure now that the whole point is httpOnly-only storage).
- [ ] Update `checkToken.js` (or add a same-shaped sibling) to read
      `req.cookies?.accessToken` instead of `req.cookies?.token`, matching
      the renamed cookie.
- [ ] Decide the stateless-vs-stateful question from Phase 1 now, if you
      haven't already, and implement accordingly (skip if stateless).

**Acceptance check:** After login, devtools → Application → Cookies shows
two distinct cookies (`accessToken`, `refreshToken`) with correct names,
expiries, and the refresh cookie scoped to `/api/auth/refresh`.

---

## Phase 3 — Finish the auth routes

**Goal:** Frontend has something to call for identity, refresh, and logout.
`register`/`login` already exist and work (update them per Phase 2 above);
this phase is about the three routes that don't exist yet, plus one bug fix
on the route that does.

- [x] `POST /register`, `POST /login` — already implemented in
      `authController.js`; just need the Phase 2 token changes applied to
      them.
- [ ] **Fix `POST /logout`.** It's currently registered as
      `router.post("/logout", checkToken, logout)` — putting `checkToken`
      in front of it means if the access token is already expired or
      missing, the middleware 401s *before* `logout()` ever runs, so the
      cookie never gets cleared. Logout should always succeed, even (or
      especially) when the token is already bad. Remove `checkToken` from
      that route:
      `router.post("/logout", logout)`.
  - [ ] Update `logout()` itself: it currently does
        `res.clearCookie("token", COOKIE_OPTIONS)`. Once Phase 2 splits the
        cookie in two, this needs to become two calls —
        `res.clearCookie("accessToken", COOKIE_OPTIONS)` and
        `res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS)` — using
        the *same* options objects (especially `path`) that were used when
        each cookie was originally set, or the browser won't match and
        clear them.
- [ ] Add `GET /api/auth/me`:
  - [ ] Protected by `checkToken` (this is a legitimate use of it, unlike
        `/logout`).
  - [ ] Decide whether to trust the decoded JWT payload (`req.user` already
        has `id`/`username`/`email` from `checkToken`) or re-fetch fresh
        data with `User.findById(req.user.id)`. Trusting the payload is
        faster but can go stale if the user edits their profile without
        logging out; re-fetching is one extra DB call but always correct.
        Re-fetching is the safer default once `UserProfile` exists.
  - [ ] Returns 401 if `checkToken` rejects (already handled by the
        middleware itself — no extra code needed here).
- [ ] Add `POST /api/auth/refresh`:
  - [ ] Reads `req.cookies?.refreshToken`.
  - [ ] `jwt.verify()` against `process.env.JWT_REFRESH_SECRET`.
  - [ ] On success, calls `generateAccessToken()` and sets a fresh
        `accessToken` cookie.
  - [ ] On failure/expired, returns 401 and does **not** set any cookie.
- [ ] Add the route to `authRouter.js`:
      `router.post("/refresh", refresh)` (no `checkToken` here — the
      refresh token itself, verified inside the handler, is the auth check).

**Acceptance check:** Using curl/Postman/Thunder Client (not the browser,
so cookie handling is explicit):
- Login → get both `accessToken` and `refreshToken` cookies.
- Call `/me` with cookies → 200 + user data.
- Delete/expire the `accessToken` cookie only, call `/me` → 401.
- Call `/refresh` with a valid `refreshToken` cookie → new `accessToken`
  cookie issued.
- Delete/expire the `accessToken` cookie, call `/logout` → still returns
  200 and clears cookies (this is the bug fix above — verify it explicitly,
  it's easy to assume it works because logout "usually" has a valid token).

---

## Phase 4 — CORS & cookie hardening

**Goal:** Make the above actually work from a real browser + Vite frontend,
not just Postman.

- [ ] `cors({ origin: '<exact frontend URL>', credentials: true })` — no
      wildcard `origin: '*'`. Not yet confirmed to exist (Phase 0 couldn't
      find it in the files reviewed) — check `app.js`/`server.js` for it.
- [ ] Confirm cookies use `sameSite: 'lax'` for same-site dev, or
      `sameSite: 'none'` + `secure: true` if frontend/backend will live on
      different domains in production. Already `'lax'` in `COOKIE_OPTIONS`
      — fine for local dev as-is.
- [ ] Fix `secure: false` in `COOKIE_OPTIONS` (`authHelper.js`) — it's
      currently hardcoded rather than env-gated. Change to something like
      `secure: process.env.NODE_ENV === "production"` so it's off in local
      http dev and on in production https automatically.
- [ ] Double check no route accidentally allows credentials from any origin.

**Acceptance check:** From the actual React dev server (not Postman), a
login request sets cookies visible in devtools, and a subsequent `fetch`/
`axios` call with `withCredentials: true` successfully sends them.

---

## Phase 5 — Route protection consistency

**Goal:** Every route that should require auth actually does, consistently.
`checkToken.js` already exists and is written generically enough to reuse
as-is on every future protected route (posts, comments, groups, votes) —
its only current problem is being applied to `/logout`, which Phase 3
already fixes. This phase is about applying it correctly going forward as
new routers get added.

- [ ] Audit all existing routes; list which ones currently use `checkToken`
      and which don't but should.
- [ ] Apply `checkToken` uniformly on new protected routers as they're
      built (posts, comments, groups, votes, saved posts).
- [ ] Decide and implement consistent error shape for 401s (e.g.
      `{ message: "Unauthorized" }`) so the frontend can branch on it
      reliably. `ErrorHandler` already exists and is used consistently in
      `checkToken.js` — confirm its output shape matches what the frontend
      plan expects and keep using it rather than inventing a second error
      format.
- [ ] If there's role-based access anywhere, confirm it runs *after*
      `checkToken`, not instead of it.

**Acceptance check:** Manually hit every protected route with no cookie —
all return 401, none leak data.

---

## Phase 6 — Edge cases & cleanup

**Goal:** Handle the messy real-world cases and clean up loose ends spotted
in the current code.

- [ ] Expired access token + valid refresh token → refresh flow works
      end-to-end (paired with frontend interceptor from the frontend plan).
- [ ] Expired/invalid refresh token → `/refresh` cleanly 401s, does not
      throw an unhandled error.
- [ ] Registering while already logged in — decide desired behavior
      (block it, or allow and overwrite session) and implement it explicitly.
- [ ] **Stop returning the raw token in the response body.** Both `register`
      and `login` currently return `{ token, user: {...} }` in the JSON
      response, in addition to setting the httpOnly cookie. Since the
      frontend never needs to read or store the token itself (that's the
      whole point of httpOnly cookies), drop the `token` field from both
      response payloads — it's an unnecessary secondary place the JWT ends
      up, for no functional benefit.
- [ ] **Align cookie lifetime with token lifetime.** `COOKIE_OPTIONS` (and
      the new refresh cookie options from Phase 2) don't set `maxAge` or
      `expires`, so both cookies behave as browser-session cookies — they
      disappear on browser close regardless of how long the JWT inside them
      is actually valid for, and conversely could stick around in a
      long-running browser tab past what you intended. Set `maxAge` on each
      cookie to match its token's `expiresIn` (e.g. 15 minutes in ms for the
      access cookie, 7 days in ms for the refresh cookie).
- [ ] Remove any leftover debug `console.log`s of tokens/cookies.

**Note:** the "logout must work even with an expired/invalid token" edge
case is already handled as a direct bug fix in Phase 3, not left for here.

---

## Phase 7 (optional, later) — Hardening

Not required for a working flow, but worth flagging as future work rather
than doing now:

- [ ] Refresh token rotation (issue a new refresh token on each use,
      invalidate the old one).
- [ ] Server-side refresh token revocation list / DB-backed sessions so
      logout-everywhere is possible.
- [ ] Rate limiting on `/login`, `/register`, `/refresh`.