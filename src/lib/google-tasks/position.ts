import type { GoogleTask } from './types';

/** Printable ASCII range used when generating optimistic `position` strings. */
const MIN_CHAR_CODE = 0x20;
const MAX_CHAR_CODE = 0x7e;
const MAX_POSITION_LENGTH = 64;

/** Lexicographic order per Google Tasks API `position` field. */
export function compareGoogleTaskPosition(a: GoogleTask, b: GoogleTask): number {
  const posA = a.position ?? '';
  const posB = b.position ?? '';
  if (posA === posB) {
    return 0;
  }
  if (!posA) {
    return 1;
  }
  if (!posB) {
    return -1;
  }
  return posA < posB ? -1 : 1;
}

/**
 * Optimistic `position` strictly between `previous` and `next` (lexicographic).
 * `previous = ''` means "before everything", `next = null` means "after everything".
 * The real value from Google replaces it once the move succeeds.
 */
export function googleTaskPositionBetween(previous: string, next: string | null): string {
  const upper = next !== null && next !== '' && previous < next ? next : null;
  let result = '';
  let boundedByUpper = upper !== null;

  for (let i = 0; i < MAX_POSITION_LENGTH; i++) {
    const lo = i < previous.length ? previous.charCodeAt(i) : MIN_CHAR_CODE - 1;
    const hi =
      boundedByUpper && upper !== null && i < upper.length
        ? upper.charCodeAt(i)
        : MAX_CHAR_CODE + 1;

    if (hi - lo > 1) {
      return result + String.fromCharCode((lo + hi) >> 1);
    }

    if (lo < MIN_CHAR_CODE) {
      // `previous` is exhausted and `upper` sits at the lowest char: follow `upper`.
      result += String.fromCharCode(hi);
      continue;
    }

    result += String.fromCharCode(lo);
    if (hi !== lo) {
      // Already below `upper` at this char, so only `previous` bounds the rest.
      boundedByUpper = false;
    }
  }

  return `${previous}~`;
}
