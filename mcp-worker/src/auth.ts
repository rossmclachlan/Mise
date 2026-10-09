// The sign-in step of connecting Claude to Priorities. When someone adds the
// connector, Claude sends them here; they sign in with their Priorities email and
// password (checked by Firebase Auth, server-side), and we hand Claude a token
// for that person. Only the two allowlisted accounts get one.

import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";

type Bindings = Env & { OAUTH_PROVIDER: OAuthHelpers };

export interface Props {
	uid: string;
	email: string;
	[key: string]: unknown;
}

const CSRF_COOKIE = "__Host-priorities_csrf";
const STATE_TTL_SECONDS = 600;

const app = new Hono<{ Bindings: Bindings }>();

function escape(s: string): string {
	return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function randomToken(): string {
	return [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get("cookie") ?? "";
	for (const part of header.split(";")) {
		const [k, ...v] = part.trim().split("=");
		if (k === name) return v.join("=");
	}
	return null;
}

function page(opts: { clientName: string; state: string; csrf: string; error?: string; email?: string }): string {
	return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Claude to Priorities</title>
<style>
  body { font: 16px system-ui, sans-serif; background: #F7F6F1; color: #1B1D20; margin: 0; }
  main { max-width: 22rem; margin: 12vh auto; padding: 0 1.25rem; }
  h1 { font-size: 1.6rem; margin: .5rem 0 .25rem; color: #3D5A80; }
  p { color: #6B7079; margin: 0 0 1.25rem; }
  input { box-sizing: border-box; width: 100%; padding: .7rem .8rem; margin: 0 0 .7rem; font: inherit;
          border: 1px solid #DFE2E6; border-radius: .75rem; background: #fff; }
  button { width: 100%; padding: .8rem; font: 600 1rem system-ui; color: #fff; background: #3D5A80;
           border: 0; border-radius: 999px; }
  .error { background: #FEE2E2; color: #7F1D1D; padding: .6rem .8rem; border-radius: .75rem; margin: 0 0 .9rem; }
</style></head>
<body><main>
  <div style="font-size:2.2rem">🐧🐧</div>
  <h1>Connect to Priorities</h1>
  <p>${escape(opts.clientName)} wants to read and update your Priorities list as you. Sign in with your Priorities email and password.</p>
  ${opts.error ? `<div class="error">${escape(opts.error)}</div>` : ""}
  <form method="post" action="/authorize">
    <input type="hidden" name="state" value="${escape(opts.state)}">
    <input type="hidden" name="csrf" value="${escape(opts.csrf)}">
    <input type="email" name="email" placeholder="Email" autocomplete="email" required value="${escape(opts.email ?? "")}">
    <input type="password" name="password" placeholder="Password" autocomplete="current-password" required>
    <button type="submit">Sign in and connect</button>
  </form>
</main></body></html>`;
}

function csrfCookie(token: string): string {
	return `${CSRF_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL_SECONDS}`;
}

app.get("/authorize", async (c) => {
	const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
	if (!oauthReqInfo.clientId) return c.text("Invalid request", 400);
	const client = await c.env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
	if (!client) return c.text("Unknown client", 400);

	// The request waits in KV until the person signs in; the form carries only its key.
	const state = randomToken();
	await c.env.OAUTH_KV.put(`authreq:${state}`, JSON.stringify(oauthReqInfo), { expirationTtl: STATE_TTL_SECONDS });
	const csrf = randomToken();
	return c.html(page({ clientName: client.clientName || "An app", state, csrf }), 200, { "set-cookie": csrfCookie(csrf) });
});

app.post("/authorize", async (c) => {
	const form = await c.req.raw.formData();
	const state = String(form.get("state") ?? "");
	const csrf = String(form.get("csrf") ?? "");
	const email = String(form.get("email") ?? "").trim();
	const password = String(form.get("password") ?? "");

	if (!csrf || csrf !== readCookie(c.req.raw, CSRF_COOKIE)) {
		return c.text("This sign-in form expired. Go back to Claude and connect again.", 400);
	}
	const stored = state ? await c.env.OAUTH_KV.get(`authreq:${state}`) : null;
	if (!stored) return c.text("This sign-in link expired. Go back to Claude and connect again.", 400);
	const oauthReqInfo = JSON.parse(stored) as AuthRequest;
	const client = await c.env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
	const retry = (error: string) =>
		c.html(page({ clientName: client?.clientName || "An app", state, csrf, error, email }), 401);

	let account: { uid: string; email: string };
	try {
		account = await firebaseSignIn(c.env, email, password);
	} catch (e) {
		console.log(JSON.stringify({ event: "sign_in_failed", email, error: String(e) }));
		return retry("That email and password didn't work.");
	}
	const allowed = c.env.ALLOWED_UIDS.split(",").map((s) => s.trim());
	if (!allowed.includes(account.uid)) {
		console.log(JSON.stringify({ event: "not_allowlisted", uid: account.uid }));
		return retry("This account isn't one of the two Priorities accounts.");
	}

	await c.env.OAUTH_KV.delete(`authreq:${state}`);
	const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
		request: oauthReqInfo,
		userId: account.uid,
		metadata: { label: account.email },
		scope: oauthReqInfo.scope,
		props: { uid: account.uid, email: account.email } satisfies Props,
	});
	console.log(JSON.stringify({ event: "connected", uid: account.uid, client: client?.clientName }));
	return new Response(null, {
		status: 302,
		headers: { location: redirectTo, "set-cookie": `${CSRF_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` },
	});
});

app.get("/", (c) => c.text("Priorities MCP server. Add https://<this host>/mcp as a custom connector in Claude."));

/** Checks the email and password with Firebase Auth's REST API and returns the account. */
async function firebaseSignIn(env: Env, email: string, password: string): Promise<{ uid: string; email: string }> {
	const base = env.FIREBASE_AUTH_EMULATOR_HOST
		? `http://${env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`
		: "https://identitytoolkit.googleapis.com/v1";
	const res = await fetch(`${base}/accounts:signInWithPassword?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			// In case the API key only allows requests from the apps' own site.
			referer: "https://rossmclachlan.github.io/",
		},
		body: JSON.stringify({ email, password, returnSecureToken: false }),
	});
	const body = (await res.json()) as { localId?: string; email?: string; error?: { message?: string } };
	if (!res.ok || !body.localId) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
	return { uid: body.localId, email: body.email ?? email };
}

export { app as AuthHandler };
