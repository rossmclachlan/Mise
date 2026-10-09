import { useState } from 'react';
import { CalendarDays, Pencil, Plus, Radar, X } from 'lucide-react';
import type { CalendarFeed } from '../types';
import { addDays, formatShort, localDay, today } from '../lib/dates';
import { factsBetween } from '../lib/calendar';
import { formatWhen } from '../lib/format';
import { DEFAULT_HOUSE_RULES } from '../lib/houseRules';
import { WINDOW_DAYS } from '../lib/horizon';
import { usePriorities } from '../state/PrioritiesContext';

/**
 * Our shared house rules (what both our Claudes read before planning), the
 * school calendar feeds the Worker reads daily, and what the radar did lately.
 */
export function HouseRulesView() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start">
      <Rules />
      <div className="space-y-6">
        <SchoolCalendar />
        <RadarRuns />
      </div>
    </div>
  );
}

function Rules() {
  const { household, nameOf, saveHouseRules } = usePriorities();
  const rules = household.house_rules;
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (draft === null) return;
    setBusy(true);
    await saveHouseRules(draft.trim());
    setBusy(false);
    setDraft(null);
  }

  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="heading-section">House rules</h2>
        {draft === null && (
          <button type="button" onClick={() => setDraft(rules?.text ?? DEFAULT_HOUSE_RULES)} className="chip">
            <Pencil size={14} /> Edit
          </button>
        )}
      </div>
      <p className="mb-3 text-sm text-ink-variant">
        Both our Claudes read these before planning or running the radar.{' '}
        {rules
          ? `Last changed ${formatShort(localDay(rules.updated_at))} by ${nameOf(rules.updated_by)}.`
          : 'This is the starting draft.'}
      </p>
      {draft === null ? (
        <div className="card whitespace-pre-wrap px-4 py-4 text-[15px] leading-relaxed text-ink">
          {rules?.text ?? DEFAULT_HOUSE_RULES}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="input-field min-h-[60vh] font-mono text-sm leading-relaxed"
          />
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy || draft.trim().length < 20} className="btn-filled flex-1">
              Save
            </button>
            <button type="button" onClick={() => setDraft(null)} className="btn-outlined flex-1">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SchoolCalendar() {
  const { household, saveFeeds } = usePriorities();
  const feeds = household.calendar_feeds ?? [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const now = today();
  const upcoming = factsBetween(household.calendar_facts ?? [], now, addDays(now, WINDOW_DAYS)).filter(
    (f) => f.kind !== 'event',
  );

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !/^(https?|webcals?):\/\//i.test(url.trim())) return;
    await saveFeeds([...feeds, { name: name.trim(), url: url.trim() }]);
    setName('');
    setUrl('');
    setAdding(false);
  }

  const remove = (f: CalendarFeed) => saveFeeds(feeds.filter((x) => x !== f));

  return (
    <section>
      <h2 className="heading-section mb-1 flex items-center gap-2">
        <CalendarDays size={20} /> School calendar
      </h2>
      <p className="mb-3 text-sm text-ink-variant">
        Read every morning, so the radar knows about days off before they sneak up.
        {household.calendar_refreshed_at && ` Last read ${formatShort(localDay(household.calendar_refreshed_at))}.`}
      </p>

      <div className="card divide-y divide-outline px-4">
        {feeds.map((f) => (
          <div key={f.url} className="flex items-center gap-2 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">{f.name}</span>
              <span className="block truncate text-xs text-ink-variant">{f.url}</span>
            </span>
            <button type="button" onClick={() => remove(f)} aria-label={`Remove ${f.name}`} className="p-1 text-ink-variant">
              <X size={16} />
            </button>
          </div>
        ))}
        {adding ? (
          <form onSubmit={add} className="flex flex-col gap-2 py-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Lincoln Elementary" className="input-field py-2" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Calendar link (.ics or webcal://)"
              inputMode="url"
              className="input-field py-2"
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-tonal flex-1">
                Add
              </button>
              <button type="button" onClick={() => setAdding(false)} className="btn-outlined flex-1">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center gap-2 py-3 text-sm font-semibold text-accent">
            <Plus size={16} /> Add a calendar link
          </button>
        )}
      </div>
      {household.calendar_errors?.map((e) => (
        <p key={e} className="mt-2 text-xs text-error">
          {e}
        </p>
      ))}

      <p className="label-section mb-1 mt-4">Days off and short days, next 6 weeks</p>
      {upcoming.length === 0 ? (
        <p className="text-sm text-ink-variant">None found.</p>
      ) : (
        <ul className="card divide-y divide-outline px-4">
          {upcoming.map((f) => (
            <li key={`${f.date}${f.title}`} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="min-w-0 text-[15px] text-ink">{f.title}</span>
              <span className="shrink-0 text-sm text-ink-variant">{formatWhen(f.date, f.end)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RadarRuns() {
  const { household, nameOf } = usePriorities();
  const runs = (household.radar_runs ?? []).slice(0, 4);
  return (
    <section>
      <h2 className="heading-section mb-1 flex items-center gap-2">
        <Radar size={20} /> Radar
      </h2>
      <p className="mb-3 text-sm text-ink-variant">What each weekly run did. The briefing itself is in Claude.</p>
      {runs.length === 0 ? (
        <p className="text-sm text-ink-variant">No runs yet.</p>
      ) : (
        <ul className="card divide-y divide-outline px-4">
          {runs.map((r) => (
            <li key={r.at} className="py-2.5">
              <p className="text-xs text-ink-variant">
                {nameOf(r.uid)} · {formatShort(localDay(r.at))} · {r.shared ? 'shared sweep' : 'own list only'}
              </p>
              <p className="text-[15px] text-ink">{r.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
