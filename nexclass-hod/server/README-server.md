# NexClass Server

The HOD desktop app starts this standalone Express and Socket.IO server as a child process. The server also runs directly under Node.js or in Docker and stores its database, signing key, logs, backups, and uploads beneath `DATA_DIR`.

## Run inside the HOD app

Install the HOD app dependencies and start the app as usual. The desktop shell launches `server/cli.js`, waits for its readiness message, and stops the child server when the app exits. The app stores persistent server data under `server-data/` in its user data folder.

## Run headless

With Node.js 20 or later:

```bash
cd server
cp .env.example .env
npm ci
npm start
```

For a machine with the HOD app installed, run `npm run server:headless` from the HOD app directory. That uses the bundled desktop runtime so the SQLite native module matches it.

## Run in Docker

```bash
cd server
cp .env.example .env
docker compose up --build -d
curl http://localhost:3000/api/health
```

The named Docker volume `nexclass-data` persists the database and other server data across container restarts.

## Code execution

Code execution is disabled by default. For an optional self-hosted runner, see [`../../deploy/judge0/README-judge0.md`](../../deploy/judge0/README-judge0.md). Configure `CODE_RUNNER=judge0`, `JUDGE0_URL=http://127.0.0.1:2358`, and `JUDGE0_AUTH_TOKEN` to match Judge0 `AUTHN_TOKEN`. The HOD dashboard test is restricted to the fixed `print("ok")` canary.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATA_DIR` | `./data` next to `server/` | Root directory for the database, `secret.key`, `logs/`, `backups/`, and `uploads/` |
| `PORT` | `3000` | HTTP or HTTPS listening port |
| `HOST` | `0.0.0.0` | Network interface to bind |
| `LOG_LEVEL` | `info` | Pino log level |
| `ALLOWED_ORIGINS` | empty | Comma-separated browser origins to allow in addition to local app development ports |
| `JWT_SECRET` | generated on first run | Optional externally managed token signing secret; otherwise a random key is saved in `DATA_DIR/secret.key` |
| `JWT_EXPIRES` | `7d` | Token lifetime |
| `TLS_CERT` | empty | Path to the TLS certificate; TLS is enabled when both TLS paths exist |
| `TLS_KEY` | empty | Path to the TLS private key |
| `CODE_RUNNER` | `disabled` | `disabled` or `judge0`; no public runner fallback |
| `JUDGE0_URL` | empty | Base URL of the self-hosted Judge0 instance |
| `JUDGE0_AUTH_TOKEN` | empty | Optional token matching Judge0 `AUTHN_TOKEN` |
| `CODE_MAX_CONCURRENT` | `4` | Concurrent runs; 20 additional requests wait in queue |

`server/.env.example` documents the variables. Do not commit `.env`, keys, or data files.

## Data, backup, and restore

The default standalone data directory is `server/data/`. The HOD app sets `DATA_DIR` to its user data directory under `server-data/`. Docker mounts a persistent volume at `/data`. The database is `nexclass-hod.db`; signing key, daily logs, migration backups, and uploads are stored beside it.

To back up, stop the server and copy the complete `DATA_DIR` folder. The server also creates a database backup before applying each pending migration. To restore, stop the server and replace the destination `DATA_DIR` contents with the backed-up folder, preserving `secret.key` so existing login tokens remain verifiable. Then restart the server.

## Health and migrations

`GET /api/health` reports service status, server version, uptime, database health, schema version, and connected socket count. Startup applies pending numbered migrations transactionally and stops with a clear error if any migration fails.
