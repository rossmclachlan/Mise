# Deployment Guide

## Overview

| Branch | Deployment | URL |
|--------|-----------|-----|
| `main` | GitHub Pages (existing CI workflow) | https://rossmclachlan.github.io/Mise/ |
| `firebase` | Cloudflare Pages via GitHub Actions (`.github/workflows/deploy-cloudflare.yml`) | Assigned by Cloudflare after setup |

---

## Cloudflare Pages — GitHub Actions deploy (`firebase` branch)

Pushing to `firebase` triggers `.github/workflows/deploy-cloudflare.yml`, which builds the app in CI (baking in the `VITE_FIREBASE_*` vars from GitHub secrets) and uploads the result to Cloudflare Pages with the official `cloudflare/pages-action`.

### 1. Create a Cloudflare Pages project (Direct Upload)

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/) and open **Workers & Pages**.
2. Click **Create application → Pages → Upload assets** (Direct Upload — do **not** connect the Git repo, since the GitHub Action handles builds and uploads instead).
3. Name the project `mise` (or update `projectName` in the workflow to match whatever you choose).
4. Upload any placeholder file to finish creating the project — the first real deployment will come from the GitHub Action.

### 2. Get an API token and account ID

1. In the Cloudflare dashboard, go to **My Profile → API Tokens → Create Token** and use the **"Edit Cloudflare Workers"** template (or a custom token with `Account.Cloudflare Pages: Edit` permission).
2. Copy the generated token.
3. Find your **Account ID** on the Workers & Pages overview page (right-hand sidebar).

### 3. Add GitHub Actions secrets

In the GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | The API token from step 2 |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `VITE_FIREBASE_API_KEY` | Your Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | e.g. `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | e.g. `your-project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | e.g. `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your sender ID |
| `VITE_FIREBASE_APP_ID` | Your app ID |

These Firebase values are found in the Firebase console under **Project settings → Your apps → SDK setup and configuration**.

### 4. Trigger the deploy

Push to `firebase` (or run the workflow manually from the **Actions** tab via `workflow_dispatch`). The site will be available at the Cloudflare Pages URL shown in the workflow's deploy step output.

---

## Alternative: Cloudflare's own Git integration

If you'd rather let Cloudflare build the project itself instead of using the GitHub Action above, connect the repo directly in the Cloudflare dashboard (**Create application → Pages → Connect to Git**, production branch `firebase`, build command `npm run build`, output directory `dist`) and set the same `VITE_FIREBASE_*` variables under **Settings → Environment variables**. Don't enable this **and** the GitHub Action on the same Cloudflare project — pick one, since both would deploy on every push to `firebase`.

---

## Firebase — Firestore security rules

Apply the following rules in **Firebase console → Firestore → Rules** to ensure only the authenticated user can read/write their own data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Firebase — Authorised domains

Add your Cloudflare Pages domain to **Firebase console → Authentication → Settings → Authorised domains** so that sign-in works from the preview URL (e.g. `mise-abc123.pages.dev`).

---

## Local development

Create a `.env.local` file in the project root with the same `VITE_FIREBASE_*` variables listed above. This file is git-ignored and must never be committed.

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Then run:

```bash
npm install
npm run dev
```
