import type { Household, Task } from '../types';

export interface SignedInUser {
  uid: string;
  email: string | null;
}

/** Everything the UI needs from the backend. Firestore in production, memory in demo mode. */
export interface Store {
  onAuth(cb: (user: SignedInUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;

  onHousehold(uid: string, cb: (h: Household | null) => void, onError: (e: Error) => void): () => void;
  createHousehold(uid: string, displayName: string): Promise<void>;
  /** Join with the code the other person shares; it is the household's id. */
  joinHousehold(hid: string, uid: string, displayName: string): Promise<void>;

  /** Shared tasks plus this person's personal tasks, kept live. */
  onTasks(hid: string, uid: string, cb: (tasks: Task[]) => void, onError: (e: Error) => void): () => void;
  addTask(hid: string, task: Task): Promise<void>;
  updateTask(hid: string, id: string, update: Partial<Task>): Promise<void>;
  /** Marks one occurrence done and creates the next, atomically. */
  completeWithNext(hid: string, id: string, update: Partial<Task>, next: Task | null): Promise<void>;
  deleteTask(hid: string, id: string): Promise<void>;
}
