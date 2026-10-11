// Turns feedback sent from the apps' "Send feedback" sheet into GitHub issues,
// then deletes it from Firestore. Run by .github/workflows/feedback.yml:
//   node --experimental-transform-types scripts/feedback-to-issues.ts
// Env: FIREBASE_SERVICE_ACCOUNT, GITHUB_TOKEN, GITHUB_REPOSITORY; DRY_RUN=1 only prints.
//
// Where the apps save it (both allowed by the existing firestore.rules):
// - Priorities: households/{hid}, field feedback.{id}
// - Mise: users/{MISE_UID}/feedback/{id}

import { Firestore, type ServiceAccount } from "../mcp-worker/src/firestore.ts";
import type { FeedbackRecord } from "../src/components/ui/feedback.ts";

// The shared Mise account (see firestore.rules).
const MISE_UID = "OY6CbOwlq9aXV5tiJ6FdDdSYMB12";

const LABELS: Record<string, { color: string; description: string }> = {
	feedback: { color: "c5def5", description: "Sent from the app's Send feedback button" },
	bug: { color: "d73a4a", description: "Something isn't working" },
	feature: { color: "a2eeef", description: "Idea or feature request" },
	priorities: { color: "fbca04", description: "Priorities app" },
	mise: { color: "0e8a16", description: "Mise app" },
};

const env = (k: string) => process.env[k] ?? "";
const dryRun = env("DRY_RUN") === "1";
const repo = env("GITHUB_REPOSITORY") || "rossmclachlan/Mise";

async function github(method: string, path: string, body?: unknown) {
	const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
		method,
		headers: {
			authorization: `Bearer ${env("GITHUB_TOKEN")}`,
			accept: "application/vnd.github+json",
			"content-type": "application/json",
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	return res;
}

async function ensureLabels() {
	for (const [name, l] of Object.entries(LABELS)) {
		const res = await github("POST", "/labels", { name, ...l });
		// 422 = already exists.
		if (!res.ok && res.status !== 422) throw new Error(`Creating label ${name} failed (${res.status})`);
	}
}

function issueFor(app: "priorities" | "mise", f: FeedbackRecord) {
	const appName = app === "priorities" ? "Priorities" : "Mise";
	const text = String(f.text ?? "").trim() || "(no text)";
	const firstLine = text.split("\n")[0].trim();
	const title = `${appName}: ${firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine}`;
	const quoted = text
		.split("\n")
		.map((l) => `> ${l}`)
		.join("\n");
	const body = [
		quoted,
		"",
		"| | |",
		"|---|---|",
		`| From | ${f.by_name} |`,
		`| App | ${appName}, on the **${f.where || "?"}** screen |`,
		`| Sent | ${f.at} |`,
		`| Device | \`${(f.user_agent || "?").replace(/`/g, "'")}\` |`,
		"",
		f.kind === "bug"
			? "_Bug report from the app. The scheduled Claude routine picks these up and tries to fix them._"
			: "_Idea from the app. Ideas are collected here to work on together._",
	].join("\n");
	return { title, body, labels: ["feedback", f.kind === "bug" ? "bug" : "feature", app] };
}

async function fileIssue(app: "priorities" | "mise", f: FeedbackRecord) {
	const issue = issueFor(app, f);
	if (dryRun) {
		console.log(JSON.stringify(issue, null, 2));
		return;
	}
	const res = await github("POST", "/issues", issue);
	if (!res.ok) throw new Error(`Creating issue failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
	const { html_url } = (await res.json()) as { html_url: string };
	console.log(`Filed ${html_url}`);
}

async function main() {
	const sa = JSON.parse(env("FIREBASE_SERVICE_ACCOUNT")) as ServiceAccount;
	const db = new Firestore({ projectId: sa.project_id, serviceAccount: sa });
	if (!dryRun) await ensureLabels();
	let count = 0;

	// Priorities: a map on each household doc.
	for (const h of await db.query<{ feedback?: Record<string, FeedbackRecord> }>("households", [])) {
		for (const [id, f] of Object.entries(h.data.feedback ?? {})) {
			await fileIssue("priorities", f);
			// An update whose mask names the field but whose data leaves it out deletes it.
			if (!dryRun) await db.commit([{ kind: "update", path: `households/${h.id}`, data: {}, mask: [`feedback.${id}`] }]);
			count++;
		}
	}

	// Mise: a collection under the shared account.
	for (const d of await db.query<FeedbackRecord>(`users/${MISE_UID}/feedback`, [])) {
		await fileIssue("mise", d.data);
		if (!dryRun) await db.commit([{ kind: "delete", path: `users/${MISE_UID}/feedback/${d.id}` }]);
		count++;
	}

	console.log(count ? `${count} feedback item(s) filed.` : "No new feedback.");
}

await main();
