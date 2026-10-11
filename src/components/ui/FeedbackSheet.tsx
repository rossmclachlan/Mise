import { useState, type FormEvent } from 'react';
import { BottomSheet } from './BottomSheet';
import type { FeedbackDraft, FeedbackKind } from './feedback';

/** The Send feedback form, for both apps' account menus. The app decides where it's saved. */
export function FeedbackSheet({
  isOpen,
  onClose,
  onSend,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSend: (draft: FeedbackDraft) => Promise<void>;
}) {
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function close() {
    onClose();
    // Start fresh next time, but keep an unsent draft.
    if (sent) {
      setSent(false);
      setText('');
      setKind('bug');
    }
    setProblem(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await onSend({ kind, text: text.trim() });
      setSent(true);
    } catch {
      setProblem('Couldn’t send that. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const chip = (k: FeedbackKind) => `chip flex-1 ${kind === k ? 'chip-on' : ''}`;

  return (
    <BottomSheet dialogOnWide isOpen={isOpen} onClose={close} title="Send feedback">
      {sent ? (
        <div className="flex flex-col gap-4 pt-1">
          <p className="text-sm text-ink">
            {kind === 'bug'
              ? 'Thanks! Claude will look at this bug and try to fix it, usually within a day.'
              : 'Thanks! It’s on the list of ideas to work on.'}
          </p>
          <button type="button" onClick={close} className="btn-filled w-full">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 pt-1">
          <div className="flex gap-2" role="radiogroup" aria-label="Kind of feedback">
            <button type="button" role="radio" aria-checked={kind === 'bug'} className={chip('bug')} onClick={() => setKind('bug')}>
              🐞 Something’s wrong
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'feature'}
              className={chip('feature')}
              onClick={() => setKind('feature')}
            >
              💡 Idea
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            rows={5}
            placeholder={
              kind === 'bug'
                ? 'What happened, and what did you expect? e.g. “Ticking a staple un-ticked a different one”'
                : 'What would make this better?'
            }
            className="input-field w-full resize-none"
          />
          {problem && <p className="text-sm text-error">{problem}</p>}
          <button type="submit" disabled={!text.trim() || busy} className="btn-filled w-full">
            {busy ? 'Sending…' : 'Send'}
          </button>
        </form>
      )}
    </BottomSheet>
  );
}
