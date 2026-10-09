# Mise — project notes for Claude

## Workflow

- **Merging: always go straight to `main`.** No need to ask "PR or main?" —
  branch, commit, push, then fast-forward merge into `main` and push. Only open
  a pull request if explicitly asked.
- **After every push to `main`, verify the Pages deploy succeeded.** The
  `deploy.yml` workflow deploys to GitHub Pages on push; check its run goes
  green (it has flaked before with a `deployment_queued` timeout). If it fails
  transiently, retrigger with an empty commit — the integration token can't
  re-run Actions jobs directly.

## Priorities

- Mise is served at `/Mise/meals/` and Priorities (`priorities/`, the shared to-do
  app) at `/Mise/priorities/`. Keep their scopes side by side: nested scopes made
  Chrome on Android treat them as one app. `/Mise/` is only `root/` (a
  redirect plus a worker-removal `sw.js`); keep that `sw.js` deployed. `npm run build` builds both; `npm test` runs its logic tests.
- Both apps share one look ("Homegrown"): `src/components/ui/brand.css` holds the
  shared tokens and component classes, and each app's `index.css` sets only its own
  colours and display face. The Calm / Sunny / Wild Look setting (`whimsy.ts`) is
  saved per phone and also applied by a small script in each `index.html`.
- `firestore.rules` covers both apps. Changing it means redeploying the rules
  (console or Firebase CLI); `deploy.yml` does not deploy them.
- `mcp-worker/` is Priorities' MCP server (Cloudflare Worker), deployed by
  `deploy-mcp-worker.yml`. It imports the app's logic from `priorities/src/lib`, so
  changes there affect both; run `npm run type-check` in `mcp-worker/` too.
  `skills/priorities/SKILL.md` is the matching Claude skill.
