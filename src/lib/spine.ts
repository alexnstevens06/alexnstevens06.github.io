import type { HomeEntry } from './content';

export type SpineMark = {
  id: string;
  title: string;
  when: string;
  at: number;
};

export type SpineYear = {
  year: string;
  at: number;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthIndex(iso: string): number {
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (!match) return 0;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

function shortWhen(iso: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (!match) return '';
  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Stable fragment id. Matches the previous home-page anchors (`entry-projects-polite`). */
export function entryAnchor(entry: { href: string | null; title: string }): string {
  const raw = (entry.href || entry.title).toLowerCase();
  const slug = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `entry-${slug}`;
}

/**
 * Oldest at the left. Marks share a month are nudged apart so their hit
 * targets do not stack. Years sit on the same 0–1 scale.
 */
export function buildSpine(entries: HomeEntry[]): { marks: SpineMark[]; years: SpineYear[] } {
  const chrono = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (a.entry.date < b.entry.date ? -1 : a.entry.date > b.entry.date ? 1 : a.index - b.index));

  if (chrono.length === 0) return { marks: [], years: [] };

  const start = monthIndex(chrono[0].entry.date);
  const end = monthIndex(chrono[chrono.length - 1].entry.date);
  const span = Math.max(1, end - start);

  const byMonth = new Map<number, HomeEntry[]>();
  for (const item of chrono) {
    const month = monthIndex(item.entry.date);
    const list = byMonth.get(month) ?? [];
    list.push(item.entry);
    byMonth.set(month, list);
  }

  const marks: SpineMark[] = [];
  for (let month = start; month <= end; month++) {
    const list = byMonth.get(month);
    if (!list) continue;
    const base = (month - start) / span;
    list.forEach((entry, index) => {
      const at = clamp01(base + (index - (list.length - 1) / 2) * 0.028);
      marks.push({
        id: entryAnchor(entry),
        title: entry.title,
        when: entry.period || shortWhen(entry.date),
        at,
      });
    });
  }

  const years: SpineYear[] = [];
  const firstYear = Math.floor(start / 12);
  const lastYear = Math.floor(end / 12);
  for (let year = firstYear; year <= lastYear; year++) {
    years.push({
      year: String(year),
      at: clamp01((year * 12 - start) / span),
    });
  }

  return { marks, years };
}
