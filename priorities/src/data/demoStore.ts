import type { Household, Task } from '../types';
import { addDays, today, weekStart } from '../lib/dates';
import { buildTask, type Actor } from '../lib/ops';
import type { SignedInUser, Store } from './store';

// In-memory backend for local development (`npm run dev:priorities`, then open
// /Mise/priorities/?demo). Dev builds only; never bundled into production.

const ROSS = 'demo-ross';
const EMILY = 'demo-emily';

function seed(): Task[] {
  const now = today();
  const at = new Date().toISOString();
  const ross: Actor = { uid: ROSS, via: 'app' };
  const claude: Actor = { uid: EMILY, via: 'mcp' };
  const t = (input: Parameters<typeof buildTask>[0], extra: Partial<Task> = {}, by = ross) => ({
    ...buildTask(input, by, at),
    ...extra,
  });
  const thursday = addDays(weekStart(now), 3);
  return [
    t({ title: 'Renew car insurance', list: 'shared', assignee: [ROSS], do_by: addDays(weekStart(now), 6) }, {
      source_url: 'https://mail.google.com/',
      notes: [{ id: 'n1', text: 'From the renewal email: policy ends on the 12th.', uid: EMILY, via: 'mcp', at }],
    }, claude),
    t({ title: 'Call plumber about boiler', list: 'shared', assignee: [ROSS], do_by: addDays(now, -1) }),
    t({ title: 'Pay water bill', list: 'personal', do_by: addDays(now, 1) }),
    t({ title: 'Put trash out', list: 'shared', assignee: [ROSS, EMILY], do_by: thursday >= now ? thursday : addDays(thursday, 7),
      repeat: { every: 1, unit: 'week', mode: 'schedule' } }),
    t({ title: 'Renew passports', list: 'shared', assignee: [ROSS], deadline: addDays(now, 69) }, {
      steps: [
        { id: 's1', title: 'Get photos', done_at: null, assignee: ROSS, do_by: addDays(now, 2) },
        { id: 's2', title: 'Fill in forms', done_at: null, assignee: EMILY, do_by: addDays(now, 39) },
        { id: 's3', title: 'Mail applications', done_at: null, assignee: null, do_by: addDays(now, 69) },
      ],
    }, claude),
    t({ title: 'Sign field trip permission slip', list: 'shared', assignee: [EMILY], do_by: addDays(now, 2) }),
    t({ title: 'Book dentist', list: 'shared', assignee: [], do_by: addDays(now, 12) }),
    t({ title: 'Renew car registration', list: 'shared', assignee: [ROSS], do_by: addDays(now, 25), deadline: addDays(now, 36) }),
    t({ title: 'Plan garden for spring', list: 'shared', assignee: [], horizon: 'later' }),
    t({ title: 'Book kids\' checkups', list: 'shared', assignee: [ROSS] }, {
      done_at: addDays(now, -2) + 'T17:00:00.000Z', done_by: ROSS, when: addDays(now, 13),
      outcome_note: 'Dr. Alvarez, 3:30pm, both kids back to back. Confirmation #48213.',
      repeat: { every: 1, unit: 'year', mode: 'schedule' },
      steps: [
        { id: 'c1', title: 'Call pediatrician\'s office', done_at: at, assignee: ROSS, do_by: null },
        { id: 'c2', title: 'Fill in school health form', done_at: at, assignee: EMILY, do_by: null },
      ],
      notes: [
        { id: 'n2', text: 'From the school email: checkups due by Nov 1.', uid: EMILY, via: 'mcp', at },
        { id: 'n3', text: 'Ask for Dr. Alvarez, she knows them.', uid: EMILY, via: 'app', at },
      ],
    }),
    t({ title: 'Property tax', list: 'shared', assignee: [EMILY] }, {
      done_at: addDays(now, -1) + 'T17:00:00.000Z', done_by: EMILY, when: addDays(now, 21),
      outcome_note: 'Payment scheduled for the 28th from checking. Due Nov 1.',
    }),
    t({ title: 'Thanksgiving break plans', list: 'shared', assignee: [ROSS, EMILY] }, {
      done_at: addDays(now, -5) + 'T17:00:00.000Z', done_by: EMILY, when: addDays(now, 50),
      outcome_note: 'Flights booked, kids\' camp booked for Nov 26–29.',
    }),
    t({ title: 'Return library books', list: 'personal' }, { done_at: addDays(now, -1) + 'T09:00:00.000Z', done_by: ROSS }),
  ];
}

const as = new URLSearchParams(location.search).get('as') === 'emily' ? EMILY : ROSS;
let user: SignedInUser | null = { uid: as, email: `${as.slice(5)}@example.com` };
let tasks = seed();
const household: Household = {
  id: 'demo-household',
  name: 'Our household',
  members: [ROSS, EMILY],
  member_names: { [ROSS]: 'Ross', [EMILY]: 'Emily' },
};

const authSubs = new Set<(u: SignedInUser | null) => void>();
const taskSubs = new Set<() => void>();
const notify = () => taskSubs.forEach((f) => f());

export const demoStore: Store = {
  onAuth(cb) {
    authSubs.add(cb);
    cb(user);
    return () => authSubs.delete(cb);
  },
  async signIn() {
    user = { uid: as, email: 'demo@example.com' };
    authSubs.forEach((f) => f(user));
  },
  async signOut() {
    user = null;
    authSubs.forEach((f) => f(null));
  },
  onHousehold(_uid, cb) {
    cb(household);
    return () => {};
  },
  async createHousehold() {},
  async joinHousehold() {},
  onTasks(_hid, uid, cb) {
    const emit = () =>
      cb(tasks.filter((t) => t.list === 'shared' || t.owner_uid === uid).map((t) => ({ ...t })));
    taskSubs.add(emit);
    emit();
    return () => taskSubs.delete(emit);
  },
  async addTask(_hid, task) {
    tasks = [...tasks, task];
    notify();
  },
  async updateTask(_hid, id, update) {
    tasks = tasks.map((t) => (t.id === id ? { ...t, ...update } : t));
    notify();
  },
  async completeWithNext(_hid, id, update, next) {
    tasks = tasks.map((t) => (t.id === id ? { ...t, ...update } : t));
    if (next) tasks = [...tasks, next];
    notify();
  },
  async deleteTask(_hid, id) {
    tasks = tasks.filter((t) => t.id !== id);
    notify();
  },
};
