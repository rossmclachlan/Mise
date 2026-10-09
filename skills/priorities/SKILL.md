---
name: priorities
description: Ross and Emily's shared 6-week radar and to-do list (the Priorities app). Use whenever the conversation is about our family or life-admin tasks, what's on this week, the weekly radar, planning or prioritizing, who's doing what, school days off or childcare, something that needs booking, paying, renewing or remembering, or whether something has been handled, even if the app isn't named. Also use when an email or calendar event implies something one of us needs to do.
---

# Priorities

Priorities is our 6-week radar: it makes sure nothing important falls through the cracks, without
becoming a giant task list. Its connector (the Priorities MCP server) is how you read and change it.
The tools describe themselves; this skill says when to reach for them and how we like it done.

Use our categories, with their emoji, in the app's words:
🔴 Needs action now · 🟡 Coming up · 🟢 Already handled · ⚠️ Potential gaps · ⚪ Not yet.

## Always

1. Before planning, prioritizing or suggesting tasks, read the house rules (`get_house_rules`, or
   `start_radar` for a radar run) and follow them. Either of us can change them, in the app or by asking
   you, so never rely on a remembered copy.
2. Start "what's on" questions with `get_overview`; it includes today's date in our time zone.
3. Propose, then write. Show bulk adds, reorders and deferrals as a short list and wait for a yes. A
   single obvious add can go straight in. A scheduled radar run is the one exception (below).
4. Before raising anything, check it isn't already tracked or handled: `check_coverage` for its dates,
   `search_tasks` for its subject.

## The weekly radar

When asked to run the radar (or the `weekly_radar` prompt is used), follow that prompt. In short:

- `start_radar` first. It says whether this run does the **shared sweep**. The first run in any 5 days
  does; when it doesn't, someone else's radar already covered shared things this week, so look only at
  this person's own list and at what only their email and calendar would show. Its `recent_runs` say
  what the other radar did: don't repeat it in the briefing beyond a line.
- Look for exceptions, not a calendar summary. For every school day off in the window, check childcare is
  covered: `check_coverage`, then email and calendar for a booking.
- Handled needs evidence. Ambiguous means a ⚠️ potential gap: `add_tasks` with `kind: "check"`, the
  date in question in `when` (and `when_end`), what you found or didn't in the note, and a `radar_key`.
- **radar_key** is `type:YYYY-MM-DD[:slug]`: `childcare:2026-10-12`, `gift:2026-11-03:grandma`,
  `registration:2026-11-01:winter-camp`, `travel:2026-12-19:flights`. Use the date the item is about,
  lowercase, and the same key you'd pick next week for the same thing. A key already in use, by either of
  us, open or answered, is skipped: that's what keeps two radars and repeated weeks from adding noise.
- On its own, a scheduled run may only add potential gaps and set this person's top 3 (`reorder_now`).
  Everything else is proposed in the briefing.
- `finish_radar` with a one- or two-sentence summary, then the briefing: 2-3 minutes, the five sections,
  my 3 most important planning actions, and optionally one thing I can safely not think about yet.

## Protected time and not-yet

Never treat free time as spare capacity, and leave the protected activities in the house rules alone. If
something matters eventually but not now, say "Not actionable yet — revisit in <month>" and offer to park
it under ⚪ Not yet with a do-by date of when to revisit, rather than working on it now.

## When things come up in other places

- **Email or calendar:** if something implies a task (a deadline, a form, a renewal, a booking to make),
  offer to add it, with the date and the source in the note.
- **Something just got done:** offer to mark it done with the details we'd want later (who, when, where,
  confirmation number) and the dates it covers (`when`, plus `when_end` for a range like camp Nov 25-27),
  so it shows under 🟢 Already handled. If you have calendar access, offer to add it to the calendar too.
- **A school calendar (PDF, page or email):** offer to add its days off, minimum days and breaks with
  `add_school_dates`. If the school has an iCal link, it can go in the app (menu > House rules > School
  calendar) instead, and is then read every morning.
- **"Have we...?" / "When is...?"** questions: check `search_tasks` before saying you don't know.

## Changing the house rules

When one of us states a standing preference ("dentist stuff goes to Ross", "always book flights 8 weeks
out"), offer to add it to the house rules: read them, change only that part, show the change, then
`update_house_rules`.
