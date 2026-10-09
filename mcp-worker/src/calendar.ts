// Reads each household's school calendar feeds (daily, from the Worker's cron)
// and stores the days that matter, so the radar can check them for coverage.

import { factsFromIcs, feedUrl } from "../../priorities/src/lib/calendar";
import type { CalendarFact, DateString, Household } from "../../priorities/src/types";
import type { Firestore } from "./firestore";

export async function refreshHousehold(
	db: Firestore,
	h: Household,
	today: DateString,
	at: string,
	fetcher: typeof fetch = fetch,
): Promise<{ days: number; errors: string[] }> {
	const old = h.calendar_facts ?? [];
	const facts: CalendarFact[] = old.filter((f) => f.source === "manual");
	const errors: string[] = [];
	for (const feed of h.calendar_feeds ?? []) {
		try {
			const res = await fetcher(feedUrl(feed.url), { headers: { "user-agent": "Priorities calendar reader" } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const text = await res.text();
			if (!text.includes("BEGIN:VCALENDAR")) throw new Error("that link isn't an iCal (.ics) feed");
			facts.push(...factsFromIcs(text, feed.name, today));
		} catch (e) {
			errors.push(`${feed.name}: couldn't read it (${e instanceof Error ? e.message : String(e)})`);
			// Keep what we had, so a bad morning doesn't make days off vanish.
			facts.push(...old.filter((f) => f.source === feed.name));
		}
	}
	facts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
	await db.commit([
		{
			kind: "update",
			path: `households/${h.id}`,
			data: { calendar_facts: facts, calendar_refreshed_at: at, calendar_errors: errors },
		},
	]);
	return { days: facts.length, errors };
}

/** Every household with a feed. There's one today, but nothing here assumes it. */
export async function refreshAll(db: Firestore, today: DateString, at: string): Promise<void> {
	const households = await db.query<Omit<Household, "id">>("households", []);
	for (const doc of households) {
		const h = { ...doc.data, id: doc.id } as Household;
		if (!h.calendar_feeds?.length) continue;
		const r = await refreshHousehold(db, h, today, at);
		console.log(JSON.stringify({ event: "calendar_refresh", household: h.id, ...r }));
	}
}
