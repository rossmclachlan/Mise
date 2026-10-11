// Web Push from a Worker, with WebCrypto only: VAPID signing (RFC 8292) and
// aes128gcm payload encryption (RFC 8291). Chrome, Firefox and Safari's push
// services all accept this.

export interface VapidKeys {
	/** Uncompressed P-256 public key, base64url: what phones subscribe with. */
	publicKey: string;
	privateJwk: JsonWebKey;
}

export interface PushTarget {
	endpoint: string;
	/** The subscription's keys, base64url. */
	p256dh: string;
	auth: string;
}

export const b64url = (bytes: ArrayBuffer | Uint8Array) =>
	btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
	const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const encoder = new TextEncoder();
/** UTF-8 bytes, typed for WebCrypto. */
const enc = { encode: (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(encoder.encode(s)) };

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let i = 0;
	for (const p of parts) {
		out.set(p, i);
		i += p.length;
	}
	return out;
}

export async function generateVapidKeys(): Promise<VapidKeys> {
	const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
	const raw = (await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer;
	const privateJwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
	return { publicKey: b64url(raw), privateJwk };
}

/** The Authorization header value for one push service. */
async function vapidAuth(endpoint: string, keys: VapidKeys, subject: string): Promise<string> {
	const key = await crypto.subtle.importKey("jwk", keys.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
	const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
	const claims = b64url(
		enc.encode(
			JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }),
		),
	);
	// WebCrypto's ECDSA signature is already the raw r||s form JWS wants.
	const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`));
	return `vapid t=${header}.${claims}.${b64url(sig)}, k=${keys.publicKey}`;
}

async function hkdf(salt: BufferSource, ikm: BufferSource, info: BufferSource, bytes: number) {
	const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
	return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

/** Encrypts a payload for one subscription: the aes128gcm body, a single record. */
export async function encryptPayload(target: PushTarget, payload: string): Promise<Uint8Array<ArrayBuffer>> {
	const uaPublic = fromB64url(target.p256dh);
	const authSecret = fromB64url(target.auth);
	const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
	const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer);
	const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
	const shared = new Uint8Array(
		await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey } as SubtleCryptoDeriveKeyAlgorithm, local.privateKey, 256),
	);

	const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
	const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
	const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
	const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

	const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
	// The payload, then 0x02: "last record, no padding".
	const plain = concat(enc.encode(payload), new Uint8Array([2]));
	const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, plain));

	const recordSize = new Uint8Array(4);
	new DataView(recordSize.buffer).setUint32(0, 4096);
	return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export type PushResult = "sent" | "gone" | "failed";

/** Sends one push. "gone": the phone unsubscribed or the subscription expired; forget it. */
export async function sendPush(
	target: PushTarget,
	payload: string,
	keys: VapidKeys,
	subject: string,
	fetcher: typeof fetch = fetch,
): Promise<PushResult> {
	const res = await fetcher(target.endpoint, {
		method: "POST",
		headers: {
			authorization: await vapidAuth(target.endpoint, keys, subject),
			"content-encoding": "aes128gcm",
			"content-type": "application/octet-stream",
			ttl: String(24 * 3600),
			urgency: "normal",
		},
		body: await encryptPayload(target, payload),
	});
	if (res.ok) return "sent";
	if (res.status === 404 || res.status === 410) return "gone";
	console.log(JSON.stringify({ event: "push_failed", status: res.status, body: (await res.text()).slice(0, 300) }));
	return "failed";
}
