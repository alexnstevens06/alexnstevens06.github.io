/**
 * Site-wide defaults. Content frontmatter overrides these when present.
 * Do not put secrets here.
 */
export const siteConfig = {
  name: 'Alex Stevens',
  siteUrl: 'https://alexnstevens06.github.io',
  github: 'https://github.com/alexnstevens06',
  /** Shown only when content supplies them (no placeholders). */
  email: null as string | null,
  linkedin: null as string | null,
  resume: null as string | null,
};

/** Build-time default excludes until Progenitor removes these files. */
export const DEFAULT_MEDIA_EXCLUDE = [
  'home.jpg',
  'browser.jpg',
  'home.jpeg',
  'browser.jpeg',
  'home.png',
  'browser.png',
  // Ignite: white-on-white / blank-box risk (COVERS.md)
  'litelock-logo.png',
  'monostable-capacitor-waveforms.png',
];
