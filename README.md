# Mise

A mobile-first PWA for personal meal planning and grocery shopping, served at
`/Mise/meals/`. No backend — everything is stored in `localStorage`.

## Modes

- **Plan** — Browse and add recipes, scale ingredients by servings, and build a grocery list. Manage a list of household staples.
- **Shop** — A grouped, checkable grocery list with large tap targets, optimized for use in the store. Keeps the screen awake while shopping.
- **Cook** — Search recipes and follow step-by-step instructions with a scaled ingredients accordion and built-in timers for steps that mention a duration.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The site has three parts: Mise at `/Mise/meals/`, Priorities at `/Mise/priorities/`,
and `root/` copied to `/Mise/` itself (a redirect to `/Mise/meals/`, plus a
`sw.js` that removes the service worker Mise used to have there). The two apps
have side-by-side scopes so each installs as its own app.

## Priorities

A second app in this repo: our shared 6-week radar for family life admin,
served at `/Mise/priorities/` and installable as its own home-screen app. Its
sections are 🔴 Needs action now, ⚠️ Potential gaps, 🟢 Already handled,
🟡 Coming up (6 weeks) and ⚪ Not yet. House rules and the school calendar
feeds live on its House rules page; a weekly radar in each of our Claudes fills
it through the MCP Worker (`mcp-worker/`), which also reads the feeds daily.

- Code: `priorities/` (entry `priorities/index.html`, source `priorities/src/`), built by
  `vite.priorities.config.ts` into `dist/priorities/` after Mise.
- Same Firebase project as Mise, but a separately named Firebase app
  instance, so Priorities' personal logins never sign Mise out of its shared one.
- Data: `households/{hid}` and `households/{hid}/tasks/{taskId}` in Firestore.
  Personal tasks are readable only by their owner (see `firestore.rules`).
- Logic the future MCP Worker will share lives in `priorities/src/lib/`
  (horizons, repeats, visibility, task operations), with tests.

```bash
npm run dev:priorities   # then open http://localhost:5174/Mise/priorities/?demo
npm test
```

Claude reads and updates Priorities through an MCP server in `mcp-worker/` (see its README), with a
matching skill in `skills/priorities/`.

`?demo` (dev only) uses an in-memory backend with sample tasks; add
`&as=emily` to see Emily's side.
