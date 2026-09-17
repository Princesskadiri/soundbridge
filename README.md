# SoundBridge

A React + Vite music workspace with a Node.js backend for accounts, private workspaces, images, AI specialists and Spotify catalog search. The original static site is preserved in `legacy/`.

## Run

Requires Node.js 24 or newer.

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite. JSX and API routes require the running server; do not open the HTML files directly with Live Server.

```sh
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

The backend starts automatically in development and local preview, using `.data/soundbridge.sqlite`. A standalone server and Dockerfile are also available for a single-instance deployment with persistent SQLite storage; see [Deployment](DEPLOYMENT.md). No service has been publicly deployed. PostgreSQL and hosted object storage are not configured yet.

## Try it

- `/signup`: create an account or sign in.
- `/settings`: edit your profile, upload a photo, export workspace JSON or sign out.
- `/release-planner`: plan a single, EP or album, manage tasks and upload artwork.
- `/assistants`: nine specialist AI roles, shared briefs, conversations, handoffs and saved work.
- `/music-search`: view API configuration status and search Spotify artists, albums or tracks.

Account changes save to the server with revision checks. Failed saves show retry/export controls; sign-out waits for pending saves. Old browser-only data remains separate, and a local workspace is still available without signing up. Local data is not automatically migrated into an account.

AI and Spotify requests require sign-in and server credentials. Without credentials, the app reports the missing connection and does not fabricate responses or catalog results. See [Backend and API setup](BACKEND_SETUP.md) for the exact configuration steps, API routes, architecture and deployment requirements.

## Other features

- Role, goals, genres and royalty-source onboarding
- Dashboard derived from workspace activity
- Sample creator directory, filters, profiles and saved connections
- Collaboration briefs and sample opportunity application drafts
- Royalty calculator using creator-provided rates and ownership
- CSV statement validation, duplicate detection and separate currency totals
- Analytics from release plans and statements
- Shared navigation, page search, mobile drawer and responsive layouts

Sample network listings, collaboration briefs and opportunity drafts are not live outreach. Payments, messaging, password reset and email verification are not implemented. Royalty-source selections do not connect streaming accounts. Spotify search does not provide royalty or Spotify for Artists analytics.

## Images and data

Profile photos and release covers accept JPG, PNG or WebP up to 5 MB. Preview images are resized to at most 640px and stored as JPEG. Signed-in uploads are decoded again by the server and stored privately in the database; local-mode images remain in browser storage. Photos appear in the header and release artwork appears on plan cards and the dashboard.

The database includes sensitive account data. Stop the server before copying `.data/` for a complete backup. Workspace JSON exports contain server image references for accounts, not the underlying media bytes. Workspace importing is not implemented.

CSV statements require `track,platform,amount,currency` columns. Supported currencies are USD, NGN, EUR and GBP. Negative adjustments are supported; totals never silently convert currencies.

## Code map

- `server/start.js`: standalone HTTP server, build serving, runtime configuration and graceful shutdown
- `server/request-policy.js`: shared local/public origin enforcement
- `server/backend.js`: database schema, authentication, sessions, workspace ownership, images and API routing
- `server/ai.js`: specialist instructions, Responses API calls and provider error handling
- `server/spotify.js`: server-side token exchange and catalog search
- `src/backend/useWorkspace.js`: session restoration, account switching, serialized autosave and image uploads
- `src/backend/MusicSearch.jsx`: catalog search and connection status
- `src/main.jsx`: routes and workspace workflows
- `src/ai/`: AI studio, specialists and guided handoffs
- `src/components/`: dashboard, icons and image-upload controls
- `src/domain.js`: local storage recovery, royalty calculations and statement normalization
- `src/design.css`: charcoal, lavender and lime interface styles
- `legacy/`: original HTML/CSS/JavaScript backup

## Verification

Automated tests exercise the domain logic, AI request validation, account persistence, session revocation, workspace/image isolation, save conflicts, image processing and mocked Spotify calls. The production frontend build is checked separately. Standalone HTTP tests also cover frontend routing, private-file protection, secure cookies, closed registration and configured-origin enforcement. The dev server blocks direct database/backend-source downloads.

Live OpenAI and Spotify calls still need real credentials. Visual and interactive browser verification remains pending because no browser was connected.
