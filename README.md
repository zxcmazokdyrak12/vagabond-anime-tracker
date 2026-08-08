# ⚔️ VAGABOND TRACKER (アニメ追跡)

A cinematic, avant-garde Anime Tracker inspired by the meditative and brutal ink-wash (*sumi-e*) aesthetic of Takehiko Inoue's legendary manga **"Vagabond"**. This is not just a standard catalog; it is an interactive web experience wrapped around the philosophy of a warrior's path.

Built from scratch using a custom high-performance **Node.js/Express + PostgreSQL** backend and a responsive, highly animated **React + Tailwind CSS** frontend.

---

## 👁️ Visual Philosophy & UX Innovations

*   **THE GATE (Врата):** A replacement for standard homepages. Features an expansive, cinematic wide-screen anime carousel with seamless navigation, custom ratings, and integrated season charts.
*   **MY SCROLLS (Мои свитки):** A completely redesigned anime list interface styled after traditional ancient scrolls. Static layouts are broken down into asymmetrical interactive grids.
*   **THE PATH SO FAR (Путь):** An analytical dashboard built on raw SQL aggregates, rendering user stats through large reactive Japanese Kanji (`観`, `完`, `計`, `棄`) that dynamic wobble and breathe on interaction.
*   **Ink-Wash Handling (Error 504/429):** When free Jikan API gateways timeout, the app safely handles memory states, triggers a 3-step automatic retry mechanism, and yields a muted crimson interface with custom `RETRY` actions instead of freezing.
*   **The Secret Seal Login:** Authentication routes disguised as ancient security layers. Usernames are mapped to `WARRIOR NAME`, emails to `SCROLL ADDRESS`, and encrypted passwords to `SECRET SEAL`.

---

## 🛠️ Tech Stack & Architecture

### Frontend (Client)
*   **React.js (Vite)** — SPA architecture with structural component separation.
*   **Tailwind CSS** — Custom responsive utility grids, custom monochrome paper-grain layers, and atmospheric vignette styling.
*   **Framer Motion** — Smooth spatial transitions, fade-in imagery masks, and inertial animations.
*   **Axios** — Isolated instance layer powered by structural request interceptors for automatic JWT session attachment.

### Backend (Server)
*   **Node.js & Express** — Lightweight, high-throughput RESTful API architecture.
*   **PostgreSQL (`pg` Pool)** — Relational database infrastructure utilizing optimized `COALESCE` statements for partial resource patches (`PATCH`), custom cascade deletions, and unique structural key constraints.
*   **Security & JWT Auth** — Password hashing utilizing salted `bcryptjs` and session authorization via secured `jsonwebtoken` tokens with an automatic `/auth/me` validation endpoint.
*   **Dotenv** — Environment variables encapsulation for secure external deployment variables (Neon/Supabase/Railway).

---

## 📂 Repository Structure

```text
├── client/          # React + Vite frontend application
│   ├── src/
│   │   ├── api/     # Centralized Axios configs and Jikan integration
│   │   ├── pages/   # AuthPage, TrackerPage (The Gate, Scrolls, Path)
│   │   └── main.jsx
└── server/          # Node.js + Express + PostgreSQL core
    ├── .env.example
    ├── db.js        # Automatic pool initialization and table creation schema
    └── server.js    # REST endpoints, custom JWT middlewares & core routing
```

---

## 🚀 Local Deployment (Entering The Dojo)

1. **Clone the repository:**
   ```bash
   git clone https://github.com
   ```

2. **Setup the Database & Server:**
   * Navigate to the `/server` directory and run `npm install`.
   * Create a `.env` file based on `.env.example` and supply your `DATABASE_URL` (PostgreSQL connection string) and `JWT_SECRET`.
   * Boot the backend:
     ```bash
     npm start
     ```
   * The database tables will initialize automatically on boot. Terminal will log: `DB ready` -> `Server: http://localhost:3002`.

3. **Launch the Frontend:**
   * Navigate to the `/client` directory and run `npm install`.
   * Launch the development server:
     ```bash
     npm run dev
     ```
   * Open `http://localhost:5173` in your browser, click **BEGIN YOUR PATH**, and enter the dojo.

---

## ⚖️ License & Disclaimer

Vagabond Tracker is a **non-commercial fan project** created purely for educational and portfolio demonstration purposes. All structural visual assets, original concepts, and character artwork references belong to **Takehiko Inoue** and **Kodansha**.
