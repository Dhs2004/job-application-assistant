import type { JobRecord } from '../shared/types.js';
import { normalizeTerm } from './text.js';

/** Produces a stable identity for one company, role, recipient and posting. */
export function createDedupeKey(job: JobRecord): string {
  const source = [job.company, job.title, job.applyEmail ?? '', job.url].map(normalizeTerm).join('|');
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const character of source) {
    const code = character.codePointAt(0) ?? 0;
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
  }
  return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}
