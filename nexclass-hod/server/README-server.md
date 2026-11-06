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

## Student code execution

Student code is sent to the authenticated HOD server and run in a local Docker container. It is not sent to Judge0 or another public compiler. Install Docker Desktop (Windows/macOS) or Docker Engine (Linux), then build the isolated toolchain image on the server machine:

```bash
cd server
docker build -t nexclass-code-runner:1.0 -f code-runner/Dockerfile code-runner
```

The runner supports Python, JavaScript, Java, C, and C++. Each run uses a disposable container with no network, no host file mounts, a read-only root filesystem, restricted capabilities, memory/CPU/process limits, a 10-second time limit, and capped output. The image must be built before students use Run Code. Docker must be available to the HOD server process. Code execution will report unavailable if Docker or the image is missing.

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
| `CODE_RUNNER_IMAGE` | `nexclass-code-runner:1.0` | Locally built image used to execute student code |

`server/.env.example` documents the variables. Do not commit `.env`, keys, or data files.

## Data, backup, and restore

The default standalone data directory is `server/data/`. The HOD app sets `DATA_DIR` to its user data directory under `server-data/`. Docker mounts a persistent volume at `/data`. The database is `nexclass-hod.db`; signing key, daily logs, migration backups, and uploads are stored beside it.

To back up, stop the server and copy the complete `DATA_DIR` folder. The server also creates a database backup before applying each pending migration. To restore, stop the server and replace the destination `DATA_DIR` contents with the backed-up folder, preserving `secret.key` so existing login tokens remain verifiable. Then restart the server.

## Health and migrations

`GET /api/health` reports service status, server version, uptime, database health, schema version, and connected socket count. Startup applies pending numbered migrations transactionally and stops with a clear error if any migration fails.
