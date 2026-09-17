# Deploying SoundBridge

The app now has a standalone Node server (`npm start`) that serves the built frontend and backend from one origin. This prepares a single-instance deployment with SQLite on persistent disk. No service has been deployed yet.

## Hosting contract

### Vercel with Turso

The included `vercel.json` serves the Vite build and routes API requests to
`api/index.js`. This deployment uses a hosted Turso database instead of local
SQLite. The single-instance disk requirements below apply to the standalone server.

1. Authenticate with `npx vercel login`, then link the project with `npx vercel link`.
2. Configure `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the project's Vercel
   environment settings for Production (and Preview if needed). Keep the token
   server-only. Use a separate database for previews.
3. Set `SOUNDBRIDGE_ALLOW_SIGNUP=true` if visitors should be able to create accounts.
   Registration is disabled by default. Add the optional OpenAI and Spotify
   credentials to enable those services.
4. Run `npm test`, `npm run build`, then `npx vercel deploy --prod`.
5. Verify `/api/health`, a direct `/release-planner` page load, and account persistence.

The handler derives its public origin from Vercel's environment variables. For a
custom domain, set `SOUNDBRIDGE_PUBLIC_ORIGIN` to its exact HTTPS origin. Missing
database configuration returns HTTP 503 for API requests; it never falls back to
temporary local storage. Existing local accounts are not migrated automatically.

### Standalone server

- Use Node.js 24 or newer, or the supplied Dockerfile.
- Run one process/replica with a persistent local disk. Do not use an ephemeral filesystem, a serverless function, multiple replicas, or a network-shared SQLite file.
- Terminate HTTPS at your hosting platform or reverse proxy. Preserve the public `Host` and browser `Origin` headers. Forward requests to port 3000 over a private connection; block direct public access to that port. Redirect public HTTP to HTTPS at the proxy.
- Set `SOUNDBRIDGE_PUBLIC_ORIGIN` to the exact HTTPS origin, without a trailing slash. The server checks Host and Origin against this value and uses Secure session cookies. Forwarded headers never override that configuration or determine client identity.
- Mount the database directory on persistent storage writable by the runtime user. Container user `node` uses UID 1000. The disk must survive replacements and restarts.
- Allow at least 75 seconds for graceful termination so existing AI requests can finish. Send SIGTERM to the Node process.

## Runtime configuration

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `SOUNDBRIDGE_PUBLIC_ORIGIN` | Your real origin, for example `https://music.example.com` |
| `SOUNDBRIDGE_DATABASE` | Absolute path on persistent storage, for example `/app/.data/soundbridge.sqlite` |
| `SOUNDBRIDGE_ALLOW_SIGNUP` | `false` by default for public deployments; set `true` to allow account creation |
| `PORT` | `3000` by default |
| `HOST` | `0.0.0.0` by default when a public origin is configured |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional AI connection, configured as server secrets |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Optional catalog connection, configured as server secrets |

Inject these through your host's runtime environment/secret settings. Never put secrets in Docker build arguments or frontend variables. `npm start` also reads `.env.local` if present, with existing environment variables taking precedence. The container starts Node directly and expects injected environment variables.

For a private staging launch, keep access restricted at the proxy, enable signup to create test accounts, then disable it and restart. Disabling signup does not disable existing accounts. Password reset, email verification and account deletion are still pending.

## Build and run

Without Docker, install and verify before starting with the production environment above:

```sh
npm ci
npm test
npm run build
npm start
```

For local inspection of the standalone server, leave `NODE_ENV` and `SOUNDBRIDGE_PUBLIC_ORIGIN` unset, build, then run `npm start` and open `http://127.0.0.1:3000`. This mode retains loopback-only access and local HTTP cookies.

The Dockerfile uses separate build and runtime stages, runs the tests/build, installs production dependencies, and starts as a non-root user. `.dockerignore` excludes secrets, local data and unrelated project files from the build context. This follows Docker's [multi-stage build structure](https://docs.docker.com/build/building/multi-stage/).

```sh
docker build -t soundbridge:staging .
docker volume create soundbridge-data
docker run -d --name soundbridge --restart unless-stopped \
  --stop-timeout 75 \
  -p 127.0.0.1:3000:3000 \
  --mount source=soundbridge-data,target=/app/.data \
  -e SOUNDBRIDGE_PUBLIC_ORIGIN=https://music.example.com \
  -e SOUNDBRIDGE_ALLOW_SIGNUP=false \
  soundbridge:staging
```

Replace the example origin. Place an HTTPS reverse proxy in front of the bound localhost port. On a managed container platform, configure the equivalent persistent mount, environment, private service port and one replica. Supply provider credentials separately using its secret manager.

## Health, logs and validation

`GET /api/health` performs a database query and returns `{"ok":true,"storage":"sqlite"}`. Health probes must send the configured public Host header. The container's `server/healthcheck.js` does this automatically. A 200 confirms local server/database availability, not external provider credentials or disk write capacity.

Request logs contain method, response status and duration. They exclude URLs, queries, request bodies, cookies and credentials. Send stdout/stderr to the host's log collector and monitor failures, restarts, disk space and backup age. The server sets header/body timeouts and drains connections using Node's [HTTP server shutdown APIs](https://nodejs.org/docs/latest-v24.x/api/http.html#serverclosecallback).

Before opening staging to testers:

1. Check `/api/health` through HTTPS and open a deep link such as `/release-planner` directly.
2. Enable signup temporarily, create a test account, save a profile/release and image, sign out and sign back in.
3. Restart/replace the server with the same disk, then verify the account and uploaded image still exist.
4. Confirm a second account cannot read the first account's image or workspace.
5. If provider secrets are configured, make one real AI request and Spotify search from a signed-in account.
6. Confirm `/.env.local`, `/.data/soundbridge.sqlite`, `/server/backend.js` and source maps return 404.
7. Perform and verify a backup before exposing real account data.

Automated tests cover HTTP routing, secure cookies, exact-origin enforcement, closed registration, authenticated AI routing and the existing account/data isolation behavior. Real HTTPS/proxy behavior, target-platform storage permissions, container execution and live providers require staging verification.

## Backup, restore and rollback

The database contains password hashes, sessions, workspaces and private image bytes. Restrict and encrypt backups, and store a copy away from the application disk.

For this release, use a stopped-server backup: stop the Node process/container cleanly, copy the entire mounted database directory (including any SQLite WAL/SHM files), then start the service. Do not copy only the main SQLite file while the service is running. Schedule a maintenance window for this method or use a host-level consistent snapshot mechanism you have verified.

To verify a restore, restore the directory to a separate private disk, start an isolated staging instance against it, and check sign-in, workspace contents and image access. Disable provider credentials during restore testing. Never overwrite the only current copy while testing a backup. Workspace JSON exports alone cannot restore accounts or image bytes.

Keep the previous image/release and a pre-release backup. To roll back, stop the new instance, run the previous release against its compatible disk/backup, and repeat health and sign-in checks. The current change adds no schema migration; future schema changes need versioned migrations and an explicit rollback strategy. Restoring an older backup loses changes made after that backup.

## Remaining public-launch work

This is a deployment foundation for restricted staging. Email verification, password reset and account deletion remain unimplemented. Auth/search request limits are process-local; clients behind one proxy share its socket IP for login limits. Configure edge abuse protection before opening registration. Do not trust arbitrary forwarded client IPs to bypass limits. Multi-instance hosting needs a shared rate-limit design and a database/media migration. Paid-provider spending controls and operational backup monitoring also need to be configured on the chosen host.

Docker is not available in the current development environment, so the Docker image has not been built here. The hosting platform and domain have not yet been selected.
