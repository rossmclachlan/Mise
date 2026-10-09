import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { CalendarFeed, Household, Horizon, Note, Step, Task } from '../types';
import type { SignedInUser, Store } from '../data/store';
import { today } from '../lib/dates';
import { moveToHorizon } from '../lib/horizon';
import { HORIZON_NAMES } from '../lib/format';
import {
  buildTask,
  completeTask,
  historyEntry,
  newId,
  reopenTask,
  skipOccurrence,
  type Actor,
  type CompleteDetails,
  type NewTaskInput,
} from '../lib/ops';

export interface Priorities {
  user: SignedInUser;
  household: Household;
  tasks: Task[];
  store: Store;
  nameOf(uid: string | null | undefined): string;
  otherUid: string | null;

  addTask(input: NewTaskInput): Promise<void>;
  update(task: Task, update: Partial<Task>, what?: string): Promise<void>;
  complete(task: Task, details?: CompleteDetails): Promise<{ nextId: string | null }>;
  reopen(task: Task, deleteNextId?: string | null): Promise<void>;
  skip(task: Task): Promise<void>;
  remove(task: Task): Promise<void>;
  moveTo(task: Task, horizon: Horizon): Promise<void>;
  addNote(task: Task, text: string): Promise<void>;
  setSteps(task: Task, steps: Step[], what?: string): Promise<void>;
  saveHouseRules(text: string): Promise<void>;
  saveFeeds(feeds: CalendarFeed[]): Promise<void>;
}

const Ctx = createContext<Priorities | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function usePriorities(): Priorities {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePriorities outside provider');
  return v;
}

export function PrioritiesProvider({
  store,
  user,
  household,
  tasks,
  children,
}: {
  store: Store;
  user: SignedInUser;
  household: Household;
  tasks: Task[];
  children: ReactNode;
}) {
  const hid = household.id;
  const actor: Actor = useMemo(() => ({ uid: user.uid, via: 'app' }), [user.uid]);
  const stamp = () => new Date().toISOString();

  const nameOf = useCallback(
    (uid: string | null | undefined) => (uid ? (household.member_names[uid] ?? 'Someone') : 'Nobody'),
    [household.member_names],
  );

  const update = useCallback(
    async (task: Task, changes: Partial<Task>, what?: string) => {
      const withHistory = what
        ? { ...changes, history: [...task.history, historyEntry(actor, what, stamp())] }
        : changes;
      await store.updateTask(hid, task.id, withHistory);
    },
    [store, hid, actor],
  );

  const value: Priorities = {
    user,
    household,
    tasks,
    store,
    nameOf,
    otherUid: household.members.find((m) => m !== user.uid) ?? null,

    async addTask(input) {
      await store.addTask(hid, buildTask(input, actor, stamp()));
    },
    update,
    async complete(task, details) {
      const { update: u, next } = completeTask(task, actor, stamp(), details);
      await store.completeWithNext(hid, task.id, u, next);
      return { nextId: next?.id ?? null };
    },
    async reopen(task, deleteNextId) {
      await store.updateTask(hid, task.id, reopenTask(task, actor, stamp()));
      if (deleteNextId) await store.deleteTask(hid, deleteNextId);
    },
    async skip(task) {
      await store.updateTask(hid, task.id, skipOccurrence(task, actor, stamp()));
    },
    async remove(task) {
      await store.deleteTask(hid, task.id);
    },
    async moveTo(task, horizon) {
      await update(task, moveToHorizon(task, horizon, today()), `moved to ${HORIZON_NAMES[horizon]}`);
    },
    async addNote(task, text) {
      const note: Note = { id: newId(), text: text.trim(), uid: user.uid, via: 'app', at: stamp() };
      await store.updateTask(hid, task.id, { notes: [...task.notes, note] });
    },
    async setSteps(task, steps, what) {
      await update(task, { steps }, what);
    },
    async saveHouseRules(text) {
      // Keeps the last 20 versions, as Claude's update_house_rules does.
      const history = [...(household.house_rules ? [household.house_rules] : []), ...(household.house_rules_history ?? [])].slice(0, 20);
      await store.updateHousehold(hid, {
        house_rules: { text, updated_at: stamp(), updated_by: user.uid },
        house_rules_history: history,
      });
    },
    async saveFeeds(feeds) {
      await store.updateHousehold(hid, { calendar_feeds: feeds });
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
