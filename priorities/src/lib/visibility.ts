import type { Filter, Task } from '../types';

/**
 * Whether a person may see a task at all. Personal lists are private: only
 * their owner sees them. Firestore rules and the MCP Worker enforce the same.
 */
export function canSee(task: Pick<Task, 'list' | 'owner_uid'>, uid: string): boolean {
  return task.list === 'shared' || task.owner_uid === uid;
}

/** Whether a task is "on" a person: their personal task, or a shared one on them (alone or with the other). */
export function isOnMe(task: Task, uid: string): boolean {
  if (task.list === 'personal') return task.owner_uid === uid;
  return task.assignee.includes(uid);
}

/** Visible to this person, and on any of the people picked (nobody picked = nothing). */
export function matchesFilter(task: Task, filter: Filter, uid: string): boolean {
  return canSee(task, uid) && filter.some((p) => isOnMe(task, p));
}
