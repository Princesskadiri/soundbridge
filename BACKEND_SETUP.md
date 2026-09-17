# SoundBridge backend and API setup

## Run the app

Use Node.js 24 or newer:

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Open the URL Vite prints. Create an account at `/signup`, edit your profile at `/settings`, and add release artwork at `/release-planner`. Sign out from Settings and sign in again to restore the account workspace.

The backend starts with Vite in development and preview. No separate database installation is required: accounts, workspace records, sessions, images and AI request counters live in `.data/soundbridge.sqlite`. This version uses SQLite, not PostgreSQL. Vite development/preview accepts loopback connections only. The separate standalone server supports a configured public HTTPS origin; see [Deployment](DEPLOYMENT.md) for the hosting contract, Docker build and persistence requirements. Use the same hostname consistently: `localhost` and `127.0.0.1` have separate browser cookies and local storage.

Existing browser-only workspaces remain under `soundbridge:v1`. They are not silently imported into a new account. Account workspaces do not get written to browser localStorage. Sign-out returns to the old local workspace. Import/migration is not implemented yet.

## Connect OpenAI

1. Create a project API key in the [OpenAI API platform](https://platform.openai.com/api-keys). Configure API billing/credits for that project as needed.
2. Copy `.env.example` to `.env.local` if `.env.local` does not already exist. If it exists, edit it without replacing other settings.
3. Set these server-only values:

```dotenv
OPENAI_API_KEY=your_actual_project_key
OPENAI_MODEL=gpt-4.1
```

The model is configurable; use one available to your project that supports Responses structured output. The example preserves this project's existing model choice.

4. Restart the development server.
5. Sign in, open `/assistants`, and send a short message. The connection indicator checks whether credentials are configured; only a successful request verifies the key, billing and model access.

Request path:

```text
React AI Team → authenticated /api/ai/chat → OpenAI Responses API → React
```

The server selects the specialist instructions and model, validates messages, and sends the key as a Bearer token. It uses `store: false`, a request timeout, a global concurrency limit and a default allowance of 30 request attempts per account per UTC day. Attempts after configuration is present count even if validation or the provider later fails. This is a request allowance, not a dollar-budget guarantee. Configure spending controls with the provider as well.

Keys never belong in React code, a `VITE_` variable, browser storage, screenshots or chat messages. `.env.local` is ignored by source control and denied by the dev server. The API reference describes [server-side key authentication](https://developers.openai.com/api/reference/overview); the handler implements [Responses text generation](https://developers.openai.com/api/docs/guides/text).

## Connect Spotify catalog search

1. Create an app in the [Spotify developer dashboard](https://developer.spotify.com/dashboard). Follow Spotify's current account and development-mode requirements; app creation and access depend on your account and quota mode.
2. Add the app's credentials to `.env.local`:

```dotenv
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

3. Restart the server and sign in to SoundBridge.
4. Open `/music-search`, select a market, then search for an artist, album or track. Results link to the original Spotify page.

The server exchanges credentials for a short-lived token, caches it until near expiry, and searches Spotify's catalog. Tokens and secrets are never returned to the frontend. There is a per-account search limit, request timeout and upstream rate-limit handling.

This is [client credentials authentication](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow), which supports non-user catalog endpoints. It does not connect personal playlists, listening history or Spotify for Artists analytics. Those require separate supported endpoints, user consent and an OAuth flow. Search uses the documented [Spotify search endpoint](https://developer.spotify.com/documentation/web-api/reference/search) and ten results per request. Check [Spotify quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) if access is denied.

Spotify results remain on the music-search page and are not saved into AI context or sent to OpenAI. Apple Music is not integrated in this milestone.

## Adding another API

Create a provider adapter in `server/` that calls a fixed provider URL and translates responses into the fields the app needs. Add an authenticated route in `server/backend.js`, pass server-only credentials through `vite.config.js`, and call our route from React using `src/backend/useWorkspace.js`'s `api()` helper. Add provider failure, authorization and rate-limit tests using mocked responses.

For personal account connections, add a server-side authorization-code flow with state validation, PKCE where supported, minimal scopes, encrypted token storage, token refresh and disconnect/revocation. For payments, keep secret keys on the server, verify webhook signatures, and make fulfillment idempotent. These flows are not implemented yet; do not treat adding a key as completing them.

## Current backend contract

| Route | Purpose |
| --- | --- |
| `POST /api/auth/signup` | Create a new account and session |
| `POST /api/auth/login` | Verify password and create a session |
| `GET /api/auth/session` | Restore session and workspace |
| `POST /api/auth/logout` | Revoke the current session |
| `GET /api/workspace` | Read the authenticated user's workspace |
| `PUT /api/workspace` | Save workspace with revision conflict detection |
| `POST /api/images` | Decode, resize and store a private image |
| `GET /api/images/:id` | Read an image owned by the signed-in user |
| `DELETE /api/images/:id` | Delete an owned image that is no longer referenced |
| `GET /api/integrations/status` | Read configuration booleans, never credentials |
| `GET /api/music/search` | Search the Spotify catalog |
| `GET /api/ai/status` | Check AI configuration |
| `POST /api/ai/chat` | Request a specialist response |

All protected mutations require the same-origin request and `X-Soundbridge-Account` header matching the signed-in account. The frontend helper supplies it. User IDs from request bodies never select another user's workspace. A stale account tab or stale workspace revision receives a conflict error instead of overwriting data. Unsaved changes remain in memory with retry/export controls and a page-unload warning; they are not durably backed up until the server save succeeds.

Passwords use salted scrypt hashes. Session tokens are random, stored as hashes, sent only in HttpOnly/SameSite cookies and expire after seven days. Local HTTP cookies intentionally lack `Secure`; the standalone public deployment mode uses Secure cookies and requires an explicit HTTPS origin.

Images are decoded and re-encoded on the server with Sharp, stripped of original metadata, scaled to at most 640px and stored as JPEG blobs. Each account has a 20 MB image allowance. Successful replace/remove operations attempt to delete the previous unreferenced image. Interrupted uploads can leave unused blobs; periodic orphan cleanup is a future improvement. These images are previews, not distributor-ready originals.

## Backups and deployment boundary

Stop the server before copying the entire `.data/` directory for a full local backup; it contains sensitive account and session data. Workspace JSON export contains account image URLs, not the image bytes, and is not a full server backup. There is no workspace import yet.

The standalone server now supplies configured-origin checks, Secure cookies, operational request logs and a registration toggle. Before an unrestricted public launch, add email verification, password reset, account deletion, durable rate limits and registration abuse controls. Move the workspace store to PostgreSQL and media to private object storage if required by hosting/scale; introduce tracked migrations and backup/restore checks. Use the standalone server and the explicit proxy/HTTPS contract in [Deployment](DEPLOYMENT.md) for hosted staging. Vite preview is for local inspection, not the intended public production server.

No live provider call was tested without credentials. Automated tests cover account persistence, isolation, conflicts, image validation/access, session revocation, AI authorization/allowances and mocked Spotify responses. Browser interaction and visual verification remain pending.
