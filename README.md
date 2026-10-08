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

The site has three parts: Mise at `/Mise/meals/`, Tandem at `/Mise/tandem/`,
and `root/` copied to `/Mise/` itself (a redirect to `/Mise/meals/`, plus a
`sw.js` that removes the service worker Mise used to have there). The two apps
have side-by-side scopes so each installs as its own app.

## Tandem

A second app in this repo: a shared to-do list for the two of us, served at
`/Mise/tandem/` and installable as its own home-screen app. It shows this
week's tasks first, keeps what's already been taken care of in view, and
folds This month and Later away.

- Code: `tandem/` (entry `tandem/index.html`, source `tandem/src/`), built by
  `vite.tandem.config.ts` into `dist/tandem/` after Mise.
- Same Firebase project as Mise, but a separately named Firebase app
  instance, so Tandem's personal logins never sign Mise out of its shared one.
- Data: `households/{hid}` and `households/{hid}/tasks/{taskId}` in Firestore.
  Personal tasks are readable only by their owner (see `firestore.rules`).
- Logic the future MCP Worker will share lives in `tandem/src/lib/`
  (horizons, repeats, visibility, task operations), with tests.

```bash
npm run dev:tandem   # then open http://localhost:5174/Mise/tandem/?demo
npm test
```

`?demo` (dev only) uses an in-memory backend with sample tasks; add
`&as=emily` to see Emily's side.
