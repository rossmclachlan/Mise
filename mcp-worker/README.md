# Tandem MCP server

A Cloudflare Worker that lets each of our Claude accounts read and update Tandem: add tasks from
email, plan the week, tick things off with their details, and keep the house rules. Claude acts as
whoever connected it, and only ever sees the shared list plus that person's own personal list.

- **Sign-in:** Claude's connector flow sends you to `/authorize`, where you sign in with your
  Tandem email and password. Firebase Auth checks them; only the two accounts in `ALLOWED_UIDS`
  (the same two as `firestore.rules`) get a token.
- **Data:** Firestore's REST API as the project's service account (`src/firestore.ts`). That
  bypasses security rules, so `src/tasks.ts` enforces the same visibility as the rules.
- **Logic:** the task rules (horizons, repeats, completing, deferring) are imported from the
  app, `../tandem/src/lib`, so Claude and the app behave the same.
- **Guidance:** `src/guidance.ts` holds the server instructions Claude gets on connect, the
  starting draft of the house rules (the live copy is in the household document once edited)
  and the *Plan my week* prompt.

## Deploying

`.github/workflows/deploy-mcp-worker.yml` deploys on every push to `main` that touches this folder
or the shared logic, and can be run by hand from the Actions tab. It creates the OAuth KV
namespace on its first run. It needs these repository secrets (**Settings → Secrets and
variables → Actions**); without the Cloudflare ones it typechecks and skips the deploy:

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`: the same ones nostalge-client uses.
- `FIREBASE_SERVICE_ACCOUNT`: the whole service-account key JSON (Firebase console → Project
  settings → Service accounts → Generate new private key).
- `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY`: already here for the Pages build.

The Worker is then at `https://tandem-mcp.<account>.workers.dev`.

## Connecting Claude

On claude.ai: **Settings → Connectors → Add custom connector**, URL
`https://tandem-mcp.<account>.workers.dev/mcp`, then sign in with your Tandem login. Each of us
does this in our own account. Optional: upload `../skills/tandem/` as a skill, so Claude reaches
for Tandem without being asked.

## Local development and tests

```bash
npm install
npm run type-check
# Integration tests against the Firestore emulator (needs firebase-tools and Java):
npx firebase-tools emulators:exec --only firestore --project demo-tandem "npx vitest run"
```

For `npm run dev`, a `.dev.vars` (git-ignored) can point the Worker at the emulators:
`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`,
`FIREBASE_PROJECT_ID=demo-tandem`, `ALLOWED_UIDS=...`, `FIREBASE_API_KEY=anything`,
`FIREBASE_SERVICE_ACCOUNT={}`.
