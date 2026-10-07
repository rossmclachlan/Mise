import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import type { Store } from './data/store';

// Demo mode (?demo) swaps in an in-memory backend so the UI can be worked on
// without Firebase credentials. It exists in dev builds only.
async function pickStore(): Promise<Store> {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    return (await import('./data/demoStore')).demoStore;
  }
  return (await import('./data/firestoreStore')).firestoreStore;
}

pickStore().then((store) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  );
});
