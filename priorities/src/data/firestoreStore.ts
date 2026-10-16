import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Household, Task } from '../types';
import { newId } from '../lib/ops';
import { normalizeTask } from '../lib/migrate';
import { auth, db } from './firebase';
import type { Store } from './store';

function tasksCol(hid: string) {
  return collection(db, 'households', hid, 'tasks');
}

/** Strips the id, which is the document's key rather than a field. */
function data(task: Task): Omit<Task, 'id'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...rest } = task;
  return rest;
}

/**
 * Everyday edits show at once (Firestore applies them locally) and sync when
 * the server is reachable, so they don't wait for it: offline, waiting would
 * leave a sheet stuck open until the connection came back.
 */
function queued(write: Promise<void>): Promise<void> {
  write.catch((e) => console.error('Priorities: a change was refused', e));
  return Promise.resolve();
}

export const firestoreStore: Store = {
  onAuth(cb) {
    return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null));
  },
  async signIn(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
  },
  async signOut() {
    await signOut(auth);
  },

  onHousehold(uid, cb, onError) {
    const q = query(collection(db, 'households'), where('members', 'array-contains', uid));
    return onSnapshot(
      q,
      (snap) => {
        const d = snap.docs[0];
        cb(d ? ({ ...d.data(), id: d.id } as Household) : null);
      },
      onError,
    );
  },
  async createHousehold(uid, displayName) {
    const hid = newId();
    await setDoc(doc(db, 'households', hid), {
      name: 'Our household',
      members: [uid],
      member_names: { [uid]: displayName },
    });
  },
  async joinHousehold(hid, uid, displayName) {
    await updateDoc(doc(db, 'households', hid.trim()), {
      members: arrayUnion(uid),
      [`member_names.${uid}`]: displayName,
    });
  },
  updateHousehold(hid, update) {
    return queued(updateDoc(doc(db, 'households', hid), update as Record<string, unknown>));
  },
  setPushSubscription(hid, id, sub) {
    return queued(updateDoc(doc(db, 'households', hid), { [`push_subscriptions.${id}`]: sub ?? deleteField() }));
  },
  setNotifyPrefs(hid, uid, prefs) {
    return queued(updateDoc(doc(db, 'households', hid), { [`notify.${uid}`]: prefs }));
  },
  async sendFeedback(hid, id, feedback) {
    await updateDoc(doc(db, 'households', hid), { [`feedback.${id}`]: feedback });
  },

  onTasks(hid, uid, cb, onError) {
    let shared: Task[] = [];
    let personal: Task[] = [];
    const emit = () => cb([...shared, ...personal]);
    const toTasks = (docs: { id: string; data(): unknown }[]) =>
      docs.map((d) => normalizeTask({ ...(d.data() as object), id: d.id } as Task));

    // Two queries, because Firestore rules only let each person read their own
    // personal tasks: a single query over everything would be refused.
    const unsubShared = onSnapshot(
      query(tasksCol(hid), where('list', '==', 'shared')),
      (snap) => {
        shared = toTasks(snap.docs);
        emit();
      },
      onError,
    );
    const unsubPersonal = onSnapshot(
      query(tasksCol(hid), where('list', '==', 'personal'), where('owner_uid', '==', uid)),
      (snap) => {
        personal = toTasks(snap.docs);
        emit();
      },
      onError,
    );
    return () => {
      unsubShared();
      unsubPersonal();
    };
  },
  addTask(hid, task) {
    return queued(setDoc(doc(tasksCol(hid), task.id), data(task)));
  },
  updateTask(hid, id, update) {
    return queued(updateDoc(doc(tasksCol(hid), id), update as Record<string, unknown>));
  },
  completeWithNext(hid, id, update, next) {
    const batch = writeBatch(db);
    batch.update(doc(tasksCol(hid), id), update as Record<string, unknown>);
    if (next) batch.set(doc(tasksCol(hid), next.id), data(next));
    return queued(batch.commit());
  },
  deleteTask(hid, id) {
    return queued(deleteDoc(doc(tasksCol(hid), id)));
  },
};
