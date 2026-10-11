// Send feedback, shared by both apps. Plain TypeScript (no React) so the
// Priorities types and the feedback script can import it.

export type FeedbackKind = 'bug' | 'feature';

/**
 * What each app saves when someone sends feedback. A GitHub Action
 * (.github/workflows/feedback.yml) turns it into an issue and then deletes it.
 */
export interface FeedbackRecord {
  kind: FeedbackKind;
  text: string;
  /** The screen they were on, e.g. "plan" or "now". */
  where: string;
  by_uid: string;
  by_name: string;
  at: string;
  user_agent: string;
}

export type FeedbackDraft = Pick<FeedbackRecord, 'kind' | 'text'>;

/** Short, unique and safe to use as a Firestore field name. */
export function feedbackId(): string {
  return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
