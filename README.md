## 🖼️ Preview

<table width="100%">
  <tr>
    <td width="50%" align="center"><b>The Gate</b></td>
    <td width="50%" align="center"><b>My Scrolls</b></td>
  </tr>
  <tr>
    <td><img src="docs/gate.jpg" width="100%"></td>
    <td><img src="docs/scrolls.jpg" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><b>The Path</b></td>
    <td align="center"><b>Title page, night theme</b></td>
  </tr>
  <tr>
    <td><img src="docs/path.jpg" width="100%"></td>
    <td><img src="docs/title-night.jpg" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><b>Sign in</b></td>
    <td align="center"><b>Mobile</b></td>
  </tr>
  <tr>
    <td><img src="docs/login.jpg" width="100%"></td>
    <td align="center"><img src="docs/scrolls-mobile.jpg" width="45%"></td>
  </tr>
</table>

# ⚔️ VAGABOND TRACKER (アニメ追跡)

[![CI](https://github.com/zxcmazokdyrak12/vagabond-anime-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/zxcmazokdyrak12/vagabond-anime-tracker/actions/workflows/ci.yml)

> A cinematic, avant-garde Anime Tracker inspired by the meditative and brutal ink-wash (*sumi-e*) aesthetic of Takehiko Inoue's legendary manga **"Vagabond"**. This is not just a standard catalog; it is an interactive web experience wrapped around the philosophy of a warrior's path.
>
> *Created with dedication to the warrior's path and flawless code architecture. 🏯*

---

## 👁️ Visual Philosophy & UX Innovations

* **Ink on paper:** Vagabond is drawn in sumi ink on paper, so the whole app is a sheet of washi. Every poster is *printed in ink* (grayscale, blended into the paper with `mix-blend-mode: multiply`) and the colour bleeds back in when you hover or focus it.
* **Two themes:** paper (紙) by default and night (夜) for the dark. The choice follows the system setting and is remembered.
* **Brush only where it matters:** large kanji are set in the brush face *Yuji Boku*; everything else in the mincho *Shippori Mincho B1*. Red appears only as seals: the logo, the active section and the 録 stamp that lands on a poster when you add it.
* **THE GATE (門):** the top five titles with their Japanese names written vertically like a scroll inscription, this season's anime and the top ten ranked in kanji numerals.
* **MY SCROLLS (巻):** status filters with counts, a progress stroke that grows with each episode, −/+ buttons, status and score inline. Finishing the last episode marks the title completed.
* **THE PATH (道):** raw SQL aggregates rendered as four large kanji (**観, 完, 計, 棄**), a proportion bar and your hours on the road.
* **Resilient API handling:** Jikan 429/5xx responses are retried automatically, and every failure explains what happened with a retry action.
* **Accessible by default:** keyboard focus, labelled controls, `prefers-reduced-motion` respected, responsive down to phones. The current tab and search live in the URL, so Back works as expected.

---

## 🛠️ Tech Stack & Architecture

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer%20Motion-black?style=for-the-badge&logo=framer&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-%23339933.svg?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Vitest](https://img.shields.io/badge/vitest-%236E9F18.svg?style=for-the-badge&logo=vitest&logoColor=white)

```text
Browser ──► Express API ──► PostgreSQL (raw SQL, migrations)
                │
                └──► cached client ──► Jikan (MyAnimeList) / AniList
                     TTL cache · request coalescing · throttled queue · retries
```

### Frontend
* **Strict TypeScript** end to end, with shared types for the API and the catalogue.
* **Axios layer** attaches the JWT and signs out automatically when it expires.
* **State in the URL:** the current tab and search query live in `?tab=&q=`, so Back and shared links work.
* **Optimistic updates** for episodes, status and score, rolled back if the server refuses.
* **Token-based CSS:** one stylesheet with paper/night design tokens instead of inline styles.

### Backend
* **Raw SQL** with parameterised queries: `COALESCE`/`CASE` partial updates, `LEAST()` clamping, `FILTER` aggregates for stats.
* **Migrations:** a 50-line migrator applies `migrations/NNN_*.sql` in transactions under a Postgres advisory lock and records them in `schema_migrations`. Constraints are added `NOT VALID`, so existing rows never block a deploy.
* **Catalogue proxy:** the browser never calls Jikan directly. The server caches responses (TTL), merges identical in-flight requests, queues calls to stay under Jikan's ~3 req/s limit and retries 429/5xx. Search uses AniList and falls back to Jikan.
* **Security:** bcrypt hashing, JWT auth, `helmet` headers, rate limiting of failed sign-ins per IP, identical errors for unknown email and wrong password, validation in code *and* database `CHECK`s, users isolated at the query level.
* **Operational:** central error handling (upstream 404 → 404, 429/5xx → 502), graceful shutdown on `SIGTERM`.

### Quality
* **50 automated tests.** Server: 25 API and unit tests (Vitest + Supertest) against a real PostgreSQL: auth, rate limiting, list CRUD, cross-user isolation, stats, migrations, cache behaviour. Client: 25 component and integration tests (Vitest + Testing Library).
* **CI on every pull request:** lint, typecheck, tests and build for both apps, plus a boot check that starts the server exactly like Render does.

---

## 📁 Repository Structure

```text
vagabond-anime-tracker/
├── .github/workflows/ci.yml
├── client/                    # React + Vite + TypeScript
│   └── src/
│       ├── api/               # typed Axios client
│       ├── components/        # Masthead, InkImage, Stamp, Enso loader, PosterCard…
│       ├── pages/             # Auth, AnimeDetail, Tracker + tracker/ views (with tests)
│       ├── lib/               # status constants, theme hook
│       ├── types.ts           # API and catalogue types
│       └── index.css          # design tokens and all styles (paper / night)
└── server/                    # Node.js + Express + PostgreSQL, TypeScript
    ├── migrations/            # 001_initial.sql, 002_list_constraints.sql
    ├── src/
    │   ├── app.ts             # express app factory (dependencies injected for tests)
    │   ├── index.ts           # boot: config → migrations → listen
    │   ├── migrate.ts         # SQL migrator
    │   ├── lib/               # auth, validation, cached HTTP client
    │   └── routes/            # auth, list + stats, anime catalogue
    ├── tests/                 # API and cache tests
    └── server.js              # entry for `node server.js` (imports dist/)
```

---

## 🚀 Local Deployment (Entering The Dojo)

### 1. Clone the repository
```bash
git clone https://github.com/zxcmazokdyrak12/vagabond-anime-tracker.git
cd vagabond-anime-tracker
```

### 2. Setup the Database & Server
Navigate to the `/server` directory and install back-end packages:
```bash
cd server
npm install
```
Create a `.env` file based on `.env.example` and supply your `DATABASE_URL` (PostgreSQL connection string), `JWT_SECRET` and optionally `CLIENT_URL` (allowed CORS origin). The server refuses to start without `DATABASE_URL` and `JWT_SECRET`. 

Boot the backend (`npm install` already compiled TypeScript into `dist/`):
```bash
npm start      # production build
npm run dev    # or: watch mode straight from src/
```
*Migrations run automatically on boot. Terminal will log `DB ready` and `Server: http://localhost:3002`.*

### 3. Launch the Frontend
Navigate to the `/client` directory and install dependencies:
```bash
cd ../client
npm install
```
To point the client at your local backend, create `client/.env` with `VITE_API_URL=http://localhost:3002` (see `client/.env.example`). Then launch the Vite development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser, click **Create an account**, and enter the dojo.

### 4. Run the checks
```bash
# server: needs a throwaway PostgreSQL database, the tests wipe it
cd server && TEST_DATABASE_URL=postgresql://user:pass@localhost/vagabond_test npm test
npm run typecheck

# client
cd ../client && npm run lint && npm run typecheck && npm test
```

---

## ⚖️ License & Disclaimer

Vagabond Tracker is a non-commercial fan project created purely for educational and portfolio demonstration purposes. All structural visual assets, original concepts, and character artwork references belong to Takehiko Inoue and Kodansha.
