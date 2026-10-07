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

## Tandem

- Tandem (`tandem/`) is the shared to-do app, deployed with Mise to
  `/Mise/tandem/`. `npm run build` builds both; `npm test` runs its logic tests.
- `firestore.rules` covers both apps. Changing it means redeploying the rules
  (console or Firebase CLI); `deploy.yml` does not deploy them.
