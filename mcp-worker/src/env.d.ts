// Secrets set with `wrangler secret put` (or .dev.vars locally). `wrangler types`
// only knows about bindings in wrangler.jsonc, so they are declared here.
interface PrioritiesSecrets {
	/** The Firebase service-account key JSON (Project settings -> Service accounts). */
	FIREBASE_SERVICE_ACCOUNT: string;
	/** Local dev and tests only: "localhost:8080" to use the Firestore emulator. */
	FIRESTORE_EMULATOR_HOST?: string;
	/** Local dev and tests only: "localhost:9099" to use the Auth emulator. */
	FIREBASE_AUTH_EMULATOR_HOST?: string;
}

interface Env extends PrioritiesSecrets {}

declare namespace Cloudflare {
	interface Env extends PrioritiesSecrets {}
}
