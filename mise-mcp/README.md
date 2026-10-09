# Mise MCP server

A Cloudflare Worker that lets Claude read and edit Mise: plan the week's dinners, keep the grocery,
staples, Costco and supplies lists, and add or change recipes. Modelled on the Priorities one in
`../mcp-worker/`, and deployed the same way.

- **Sign-in:** Claude's connector flow sends you to `/authorize`, where you sign in with the Mise
  email and password. Firebase Auth checks them; only the account in `ALLOWED_UIDS` (the same one
  as `firestore.rules`) gets a token.
- **Data:** Firestore's REST API as the project's service account (`../mcp-worker/src/firestore.ts`),
  under `users/{uid}` like the app. `src/mise.ts` reads and writes it the way the app does: planning
  a recipe on a day puts its ingredients on the grocery list for that day, swapping days moves them,
  "Clear checked" removes ticked items and unticks staples, corrected categories are remembered.
- **Logic:** categories, key ingredients and ingredient-line parsing are imported from the app,
  `../src/utils`, so Claude and the app agree.
- **Guidance:** `src/guidance.ts` holds the server instructions Claude gets on connect.

## Deploying

`.github/workflows/deploy-mise-mcp.yml` deploys on every push to `main` that touches this folder or
the shared code, and can be run by hand from the Actions tab. It uses the same repository secrets as
the Priorities Worker and creates its own OAuth KV namespace (`mise-mcp-oauth`) on its first run.

The Worker is at `https://mise-mcp.mclachlanrd.workers.dev`.

## Connecting Claude

On claude.ai: **Settings → Connectors → Add custom connector**, URL
`https://mise-mcp.mclachlanrd.workers.dev/mcp`, then sign in with the Mise login.

## Local development and tests

```bash
npm install
npm run type-check
npm test   # MiseData against an in-memory Firestore stand-in
```
