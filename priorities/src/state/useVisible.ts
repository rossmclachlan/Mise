import { useMemo } from 'react';
import type { Filter } from '../types';
import { matchesFilter } from '../lib/visibility';
import { usePriorities } from './PrioritiesContext';

/** Tasks the home screen and the Done view both need, under one filter. */
export function useVisible(filter: Filter) {
  const { tasks, user } = usePriorities();
  return useMemo(() => tasks.filter((t) => matchesFilter(t, filter, user.uid)), [tasks, filter, user.uid]);
}
