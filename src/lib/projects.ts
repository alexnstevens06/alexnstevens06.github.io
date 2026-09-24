/**
 * Canonical project list for the site.
 * Progenitor content lives under content/projects/<slug>/ (preferred).
 * Legacy flat content/<folder>/ names remain as fallbacks.
 * Timeline-only asset folders (e.g. timeline/ignite) are valid folder candidates.
 */
export type ProjectDef = {
  slug: string;
  title: string;
  /** Candidate folder paths under content/ (first existing wins). */
  folders: string[];
};

export const PROJECTS: ProjectDef[] = [
  { slug: 'polite', title: 'POLITE', folders: ['projects/polite', 'polite', 'POLITE'] },
  {
    slug: 'comparator',
    title: 'Comparator',
    folders: ['projects/comparator', 'comparator', 'Comparator'],
  },
  {
    slug: 'gendiff-llmzip',
    title: 'GenDiff / llmzip',
    folders: [
      'projects/gendiff-llmzip',
      'gendiff-llmzip',
      'gendiff',
      'llmzip',
      'GenDiff',
      'GenDiff-llmzip',
    ],
  },
  {
    slug: 'splendid-hopper',
    title: 'splendid-hopper',
    folders: ['projects/splendid-hopper', 'splendid-hopper', 'splendid_hopper'],
  },
  {
    slug: 'study-lens',
    title: 'study_lens',
    folders: ['projects/study-lens', 'study-lens', 'study_lens', 'studylens'],
  },
  {
    slug: 'aggie-scheduler',
    title: 'Aggie Scheduler',
    folders: [
      'projects/aggie-scheduler',
      'aggie-scheduler',
      'aggie_scheduler',
      'AggieScheduler',
    ],
  },
  {
    slug: 'lucidscan',
    title: 'LucidScan',
    folders: ['projects/lucidscan', 'lucidscan', 'LucidScan'],
  },
  {
    slug: 'ignite',
    title: 'SEC Ignite — LiteLock',
    folders: ['projects/ignite', 'timeline/ignite', 'ignite'],
  },
  {
    slug: 'ecen-350-cpu',
    title: 'ECEN 350 CPU',
    folders: [
      'projects/ecen-350-cpu',
      'ecen-350-cpu',
      'ecen_350_cpu',
      'ECEN350',
      'ecen350',
    ],
  },
  {
    slug: 'class-figures',
    title: 'class figures',
    folders: [
      'projects/class-figures',
      'class-figures',
      'class_figures',
      'classfigures',
    ],
  },
  {
    slug: 'jbl-ble',
    title: 'JBL BLE',
    folders: ['projects/jbl-ble', 'jbl-ble', 'jbl_ble', 'JBL-BLE'],
  },
];

export function getProjectBySlug(slug: string): ProjectDef | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}
