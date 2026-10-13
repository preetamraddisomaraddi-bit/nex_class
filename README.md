# NexClass (EduSync)

LAN classroom platform with an Express/Socket.IO backend, SQLite database, three Electron desktop apps, and a university registration website.

## Structure

| Directory | Application | Development port |
| --- | --- | --- |
| `server/` | Express API, Socket.IO and SQLite | 4000 |
| `teacher-app/teacher-app/` | Teacher Electron + React app | 5173 |
| `student-app/` | Student Electron + React app | 5174 |
| `admin-app/` | University administrator Electron + React app | 5175 |
| `registration-site/` | Public React registration website | 5176 |

The nested teacher directory is intentional in this checkout; use the full path above.

## Requirements

Use Node.js 22 or newer and npm. Electron requires a graphical desktop. PowerPoint conversion additionally requires LibreOffice; code execution uses the internet-based Judge0 service. PDF presentation currently downloads PDF.js from a CDN.

## Install and run

From the repository root, install each application:

```powershell
npm ci --prefix server
npm ci --prefix teacher-app/teacher-app
npm ci --prefix student-app
npm ci --prefix admin-app
npm ci --prefix registration-site
```

Build the registration portal before starting the backend:

```powershell
npm run build --prefix registration-site
Copy-Item server/.env.example server/.env
```

Edit `server/.env` and replace both JWT secrets. The server loads this file automatically. Keep it out of Git. Changing secrets invalidates existing sessions, so sign in again afterward.

Start each process in a separate terminal:

```powershell
npm start --prefix server
npm run dev --prefix teacher-app/teacher-app
npm run dev --prefix student-app
npm run dev --prefix admin-app
```

Open `http://localhost:4000/register/` to register a university. In the admin app, connect to `http://localhost:4000`, sign in using the university code and administrator credentials, then create departments/semesters and approve teachers. Teacher/student apps also use port 4000. For other devices, replace localhost with the server's LAN IP and allow inbound TCP port 4000 through Windows Firewall.

SQLite is created automatically at `server/db/edusync.db`; no separate database server is needed. Back up this file before applying changes to an existing installation. `DB_PATH` can override its location for testing. Tests use isolated databases and never modify the normal database.

For registration-site development:

```powershell
npm run dev --prefix registration-site
```

Open `http://localhost:5176/register/`. Vite proxies `/api` to port 4000. For a different backend, set `VITE_API_URL` when building the registration site.

## Verification and packaging

```powershell
npm test --prefix server
npm run build --prefix teacher-app/teacher-app
npm run build --prefix student-app
npm run build --prefix admin-app
npm run build --prefix registration-site
```

On Windows, run `npm run package --prefix <app-directory>` to build an installer. Teacher/student output goes to `release/`; admin output goes to `dist-electron/`. Installers and interactive desktop behavior still require Windows testing.

See [PROJECT_REVIEW.md](PROJECT_REVIEW.md) for verified flows, remaining gaps, changes and a Windows test checklist. `COMPLETED_FEATURES.md` is a historical feature log; its completion claims are not a test report.
