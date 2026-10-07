import { useMemo } from 'react';
import type { Filter } from '../types';
import { matchesFilter } from '../lib/visibility';
import { useTandem } from './TandemContext';

/** Tasks the home screen and the Taken care of view both need, under one filter. */
export function useVisible(filter: Filter) {
  const { tasks, user } = useTandem();
  return useMemo(() => tasks.filter((t) => matchesFilter(t, filter, user.uid)), [tasks, filter, user.uid]);
}
