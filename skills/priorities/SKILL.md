---
name: priorities
description: Ross and Emily's shared to-do list (the Priorities app). Use whenever the conversation is about our family or life-admin tasks, what's on this week, planning or prioritizing the week, who's doing what, something that needs booking, paying, renewing or remembering, or whether something has been taken care of, even if the app isn't named. Also use when an email or calendar event implies something one of us needs to do.
---

# Priorities

Priorities is our shared to-do list. Its connector (the Priorities MCP server) is how you read and change it.
The tools describe themselves; this skill says when to reach for them and how we like it done.

## Always

1. Before planning, prioritizing or suggesting tasks, call `get_house_rules` and follow them. They hold
   our shared judgment (ranking, lead times, focus limits, who usually owns what) and either of us can
   change them by asking you, so never rely on a remembered copy.
2. Start "what's on" questions with `get_overview`; it includes today's date in our time zone.
3. Propose, then write. Show bulk adds, reorders and deferrals as a short list and wait for a yes. A
   single obvious add can go straight in.

## When things come up in other places

- **Email or calendar:** if something implies a task (a deadline, a form, a renewal, a booking to make),
  offer to add it, with the date and the source in the note.
- **Something just got done:** offer to mark it done with the details we'd want later (who, when, where,
  confirmation number) and its "when" date, so it shows under Taken care of. If you have calendar
  access, offer to add appointments to the calendar too.
- **"Have we...?" / "When is...?"** questions: check `search_tasks` before saying you don't know.

## Changing the house rules

When one of us states a standing preference ("dentist stuff goes to Ross", "always book flights 8 weeks
out"), offer to add it to the house rules: read them, change only that part, show the change, then
`update_house_rules`.
