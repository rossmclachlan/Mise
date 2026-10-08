// A small Firestore REST client for Workers, where the Admin SDK does not run.
// Signs in as the project's service account (which bypasses security rules, so
// callers must enforce visibility themselves; see tasks.ts).

export interface ServiceAccount {
	project_id: string;
	client_email: string;
	private_key: string;
}

export interface FirestoreConfig {
	projectId: string;
	/** Service account JSON. Not needed against the emulator. */
	serviceAccount?: ServiceAccount;
	/** "localhost:8080" to use the Firestore emulator (tests and local dev). */
	emulatorHost?: string;
	fetcher?: typeof fetch;
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Value =
	| { nullValue: null }
	| { booleanValue: boolean }
	| { integerValue: string }
	| { doubleValue: number }
	| { stringValue: string }
	| { timestampValue: string }
	| { arrayValue: { values?: Value[] } }
	| { mapValue: { fields?: Record<string, Value> } };

export interface Doc<T = Record<string, unknown>> {
	id: string;
	data: T;
}

// ── Value encoding ─────────────────────────────────────────────────────────

export function toValue(v: unknown): Value {
	if (v === null || v === undefined) return { nullValue: null };
	if (typeof v === "boolean") return { booleanValue: v };
	if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
	if (typeof v === "string") return { stringValue: v };
	if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
	if (typeof v === "object") return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
	throw new Error(`Can't store a ${typeof v} in Firestore`);
}

export function toFields(obj: Record<string, unknown>): Record<string, Value> {
	const fields: Record<string, Value> = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v !== undefined) fields[k] = toValue(v);
	}
	return fields;
}

export function fromValue(v: Value): Json {
	if ("nullValue" in v) return null;
	if ("booleanValue" in v) return v.booleanValue;
	if ("integerValue" in v) return Number(v.integerValue);
	if ("doubleValue" in v) return v.doubleValue;
	if ("stringValue" in v) return v.stringValue;
	if ("timestampValue" in v) return v.timestampValue;
	if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(fromValue);
	if ("mapValue" in v) return fromFields(v.mapValue.fields ?? {});
	return null;
}

export function fromFields(fields: Record<string, Value>): { [k: string]: Json } {
	const out: { [k: string]: Json } = {};
	for (const [k, v] of Object.entries(fields)) out[k] = fromValue(v);
	return out;
}

// ── Service-account access token ───────────────────────────────────────────

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
	btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

let cachedToken: { token: string; expires: number; email: string } | null = null;

async function accessToken(sa: ServiceAccount, fetcher: typeof fetch): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	if (cachedToken && cachedToken.email === sa.client_email && cachedToken.expires > now + 60) {
		return cachedToken.token;
	}
	const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
	const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
	const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, [
		"sign",
	]);
	const enc = new TextEncoder();
	const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
	const claims = b64url(
		enc.encode(
			JSON.stringify({
				iss: sa.client_email,
				scope: "https://www.googleapis.com/auth/datastore",
				aud: "https://oauth2.googleapis.com/token",
				iat: now,
				exp: now + 3600,
			}),
		),
	);
	const sig = b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claims}`)));
	const res = await fetcher("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion: `${header}.${claims}.${sig}`,
		}),
	});
	if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
	const body = (await res.json()) as { access_token: string; expires_in: number };
	cachedToken = { token: body.access_token, expires: now + body.expires_in, email: sa.client_email };
	return body.access_token;
}

// ── Client ─────────────────────────────────────────────────────────────────

export type FieldFilter = [field: string, op: "EQUAL" | "ARRAY_CONTAINS", value: unknown];

export type Write =
	| { kind: "create"; path: string; data: Record<string, unknown> }
	| { kind: "update"; path: string; data: Record<string, unknown> }
	| { kind: "delete"; path: string };

export class Firestore {
	private readonly base: string;
	private readonly root: string;
	private readonly fetcher: typeof fetch;

	constructor(private readonly cfg: FirestoreConfig) {
		this.fetcher = cfg.fetcher ?? fetch.bind(globalThis);
		this.base = cfg.emulatorHost ? `http://${cfg.emulatorHost}/v1` : "https://firestore.googleapis.com/v1";
		this.root = `projects/${cfg.projectId}/databases/(default)/documents`;
	}

	private async headers(): Promise<Record<string, string>> {
		if (this.cfg.emulatorHost) return { authorization: "Bearer owner", "content-type": "application/json" };
		if (!this.cfg.serviceAccount) throw new Error("No Firebase service account configured");
		return {
			authorization: `Bearer ${await accessToken(this.cfg.serviceAccount, this.fetcher)}`,
			"content-type": "application/json",
		};
	}

	private async call<T>(method: string, url: string, body?: unknown): Promise<T> {
		const res = await this.fetcher(url, {
			method,
			headers: await this.headers(),
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (!res.ok) throw new Error(`Firestore ${method} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
		return (await res.json()) as T;
	}

	/** One document by path ("households/abc"), or null if it doesn't exist. */
	async get<T>(path: string): Promise<Doc<T> | null> {
		const res = await this.fetcher(`${this.base}/${this.root}/${path}`, { headers: await this.headers() });
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`Firestore GET failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
		const doc = (await res.json()) as { name: string; fields?: Record<string, Value> };
		return { id: doc.name.split("/").pop()!, data: fromFields(doc.fields ?? {}) as T };
	}

	/** Documents in a collection ("households" or "households/abc/tasks") matching all filters. */
	async query<T>(collectionPath: string, filters: FieldFilter[], limit?: number): Promise<Doc<T>[]> {
		const parts = collectionPath.split("/");
		const collectionId = parts.pop()!;
		const parent = [this.root, ...parts].join("/");
		const where = filters.map(([field, op, value]) => ({
			fieldFilter: { field: { fieldPath: field }, op, value: toValue(value) },
		}));
		const structuredQuery: Record<string, unknown> = { from: [{ collectionId }] };
		if (where.length === 1) structuredQuery.where = where[0];
		if (where.length > 1) structuredQuery.where = { compositeFilter: { op: "AND", filters: where } };
		if (limit) structuredQuery.limit = limit;
		const rows = await this.call<{ document?: { name: string; fields?: Record<string, Value> } }[]>(
			"POST",
			`${this.base}/${parent}:runQuery`,
			{ structuredQuery },
		);
		return rows
			.filter((r) => r.document)
			.map((r) => ({ id: r.document!.name.split("/").pop()!, data: fromFields(r.document!.fields ?? {}) as T }));
	}

	/** Applies all writes atomically: either every one lands or none does. */
	async commit(writes: Write[]): Promise<void> {
		const name = (path: string) => `${this.root}/${path}`;
		await this.call("POST", `${this.base}/${this.root.replace(/\/documents$/, "")}/documents:commit`, {
			writes: writes.map((w) => {
				if (w.kind === "delete") return { delete: name(w.path) };
				const fields = toFields(w.data);
				if (w.kind === "create") {
					return { update: { name: name(w.path), fields }, currentDocument: { exists: false } };
				}
				return {
					update: { name: name(w.path), fields },
					updateMask: { fieldPaths: Object.keys(fields).map(quoteFieldPath) },
					currentDocument: { exists: true },
				};
			}),
		});
	}
}

/** Field paths with characters outside [A-Za-z0-9_] need backticks. */
function quoteFieldPath(p: string): string {
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(p) ? p : `\`${p.replace(/`/g, "\\`")}\``;
}
