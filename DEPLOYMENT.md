# Deployment Guide

## Overview

| Branch | Deployment | URL |
|--------|-----------|-----|
| `main` | GitHub Pages (existing CI workflow) | https://rossmclachlan.github.io/Mise/ |
| `firebase` | Cloudflare Pages (preview) | Assigned by Cloudflare after setup |

---

## Cloudflare Pages — `firebase` branch

### 1. Connect the repository

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/) and open **Workers & Pages**.
2. Click **Create application → Pages → Connect to Git**.
3. Select the **rossmclachlan/Mise** repository and authorise Cloudflare.
4. Under **Set up builds and deployments**:
   - **Production branch**: `firebase`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: *(leave blank)*
5. Click **Save and Deploy** — this first build will fail (missing env vars); that is expected.

### 2. Add environment variables

In the Cloudflare Pages project → **Settings → Environment variables**, add the following for **both** Production and Preview environments:

| Variable name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | Your Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | e.g. `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | e.g. `your-project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | e.g. `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your sender ID |
| `VITE_FIREBASE_APP_ID` | Your app ID |

These values are found in the Firebase console under **Project settings → Your apps → SDK setup and configuration**.

### 3. Trigger a redeploy

After saving the env vars, go to **Deployments** and click **Retry deployment** on the failed build. The site will be available at the Cloudflare Pages URL once the build succeeds.

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
