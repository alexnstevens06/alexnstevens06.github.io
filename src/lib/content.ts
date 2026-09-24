import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { PROJECTS, type ProjectDef } from './projects';
import { DEFAULT_MEDIA_EXCLUDE, siteConfig } from '../site.config';

const ROOT = path.resolve(process.cwd());
const CONTENT_ROOT = path.join(ROOT, 'content');

export type Frontmatter = Record<string, string | string[]>;

export type MediaItem = {
  name: string;
  relUrl: string;
  kind: 'image' | 'video';
};

export type ProjectContent = {
  def: ProjectDef;
  folder: string | null;
  folderPath: string | null;
  hasContent: boolean;
  title: string;
  hook: string | null;
  summary: string | null;
  bodyHtml: string | null;
  frontmatter: Frontmatter;
  media: MediaItem[];
  diagrams: MediaItem[];
  cover: MediaItem | null;
  statusLabel: string | null;
};

export type AboutContent = {
  hasBio: boolean;
  bioHtml: string | null;
  headshotRelUrl: string | null;
  email: string | null;
  links: { label: string; href: string }[];
  resumeHref: string | null;
  github: string | null;
};

export type TimelineEntry = {
  period: string;
  title: string;
  blurb: string;
  folder: string | null;
  thumb: MediaItem | null;
};

export type TimelineGallery = {
  folder: string;
  label: string;
  lead: MediaItem | null;
  media: MediaItem[];
  matchedEntryTitle: string | null;
};

export type TimelineContent = {
  hasTimeline: boolean;
  bodyHtml: string | null;
  entries: TimelineEntry[];
  galleries: TimelineGallery[];
  /** Latest entries for home teaser (newest first). */
  teaserEntries: TimelineEntry[];
};

function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readText(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

export function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const trimmed = raw.replace(/^\uFEFF/, '');
  if (!trimmed.startsWith('---')) return { data: {}, body: trimmed };
  const end = trimmed.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: trimmed };
  const fmBlock = trimmed.slice(3, end);
  const body = trimmed.slice(end + 4).replace(/^\r?\n/, '');
  const data: Frontmatter = {};
  const lines = fmBlock.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    const rest = m[2].trim();
    if (rest === '' || rest === '|' || rest === '>') {
      const items: string[] = [];
      i++;
      while (i < lines.length) {
        const lm = lines[i].match(/^\s+-\s+(.+)$/);
        if (!lm) break;
        items.push(unwrap(lm[1].trim()));
        i++;
      }
      data[key] = items;
      continue;
    }
    data[key] = unwrap(rest);
    i++;
  }
  return { data, body };
}

function unwrap(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function fmString(data: Frontmatter, key: string): string | null {
  const v = data[key];
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

function fmList(data: Frontmatter, key: string): string[] {
  const v = data[key];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string' && v.trim()) {
    return v.split(',').map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

async function mdToHtml(md: string): Promise<string> {
  marked.setOptions({ gfm: true, breaks: false });
  return marked.parse(md, { async: true }) as Promise<string>;
}

function stripLeadingH1(md: string): string {
  return md.replace(/^#\s+[^\n]+\n+/, '');
}

function stripPorts(text: string): string {
  return text.replace(/:61926/g, '').replace(/:3000/g, '');
}

/** Pull **Hook:** / Hook: line; return text without the label. */
export function extractHook(md: string): string | null {
  const lines = md.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\*{0,2}Hook:\*{0,2}\s*(.+)$/i);
    if (m) {
      return m[1].replace(/\*{1,2}/g, '').trim() || null;
    }
  }
  return null;
}

/** Remove Hook line(s) from markdown body so they aren't repeated. */
function stripHookLines(md: string): string {
  return md
    .split(/\r?\n/)
    .filter((line) => !/^\*{0,2}Hook:\*{0,2}\s*/i.test(line))
    .join('\n')
    .replace(/^\n+/, '');
}

/**
 * Replace ```mermaid fences with an image if a matching diagram SVG/PNG exists,
 * otherwise drop the fence (diagrams also listed separately).
 */
/** Drop raw mermaid fences; diagrams are shown as SVG/PNG separately. */
function replaceMermaidFences(md: string, _diagrams: MediaItem[]): string {
  return md.replace(/```mermaid\s*[\s\S]*?```/gi, '\n\n');
}

function resolveProjectFolder(def: ProjectDef): string | null {
  if (!exists(CONTENT_ROOT)) return null;
  for (const name of def.folders) {
    const p = path.join(CONTENT_ROOT, name);
    if (exists(p) && fs.statSync(p).isDirectory()) return name;
  }
  return null;
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.ogg']);
const DIAGRAM_STEMS = new Set(['architecture', 'datapath', 'diagram', 'flow', 'flowchart']);

function excludeSet(data: Frontmatter): Set<string> {
  const set = new Set(DEFAULT_MEDIA_EXCLUDE.map((x) => x.toLowerCase()));
  for (const e of fmList(data, 'exclude')) set.add(e.toLowerCase());
  return set;
}

function listMediaFiles(
  folderPath: string,
  folderRel: string,
  excluded: Set<string>,
): { media: MediaItem[]; diagrams: MediaItem[] } {
  const media: MediaItem[] = [];
  const diagrams: MediaItem[] = [];
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(folderPath);
  } catch {
    return { media, diagrams };
  }
  const parts = folderRel.split('/').map(encodeURIComponent).join('/');
  for (const name of entries) {
    if (excluded.has(name.toLowerCase())) continue;
    const ext = path.extname(name).toLowerCase();
    const stem = path.basename(name, ext).toLowerCase();
    const full = path.join(folderPath, name);
    if (!fs.statSync(full).isFile()) continue;
    const relUrl = `/content/${parts}/${encodeURIComponent(name)}`;
    if (ext === '.mmd') continue; // never show raw mmd; SVG sibling is preferred
    if (IMAGE_EXT.has(ext)) {
      const item: MediaItem = { name, relUrl, kind: 'image' };
      if (DIAGRAM_STEMS.has(stem) || ext === '.svg') {
        // Prefer svg diagrams in diagrams list; still allow non-diagram images in gallery
        if (DIAGRAM_STEMS.has(stem)) {
          diagrams.push(item);
          continue;
        }
      }
      media.push(item);
    } else if (VIDEO_EXT.has(ext)) {
      media.push({ name, relUrl, kind: 'video' });
    }
  }
  media.sort((a, b) => a.name.localeCompare(b.name));
  diagrams.sort((a, b) => a.name.localeCompare(b.name));
  // Prefer .svg over .png for same stem
  const byStem = new Map<string, MediaItem>();
  for (const d of diagrams) {
    const stem = path.basename(d.name, path.extname(d.name)).toLowerCase();
    const prev = byStem.get(stem);
    if (!prev) byStem.set(stem, d);
    else if (d.name.toLowerCase().endsWith('.svg')) byStem.set(stem, d);
  }
  return { media, diagrams: [...byStem.values()] };
}

function pickCover(data: Frontmatter, media: MediaItem[], diagrams: MediaItem[], folderRel: string): MediaItem | null {
  const coverName = fmString(data, 'cover');
  if (coverName) {
    const found = media.find((m) => m.name === coverName || m.name.toLowerCase() === coverName.toLowerCase());
    if (found) return found;
    // may be excluded from media if misconfigured — build URL anyway only if file exists
    const folderPath = path.join(CONTENT_ROOT, folderRel);
    const full = path.join(folderPath, coverName);
    if (exists(full)) {
      const parts = folderRel.split('/').map(encodeURIComponent).join('/');
      return {
        name: coverName,
        relUrl: `/content/${parts}/${encodeURIComponent(coverName)}`,
        kind: 'image',
      };
    }
  }
  const img = media.find((m) => m.kind === 'image');
  if (img) return img;
  return diagrams[0] || null;
}

export async function loadProject(def: ProjectDef): Promise<ProjectContent> {
  const folder = resolveProjectFolder(def);
  const statusLabel = def.slug === 'gendiff-llmzip' ? 'Ongoing research' : null;

  if (!folder) {
    return {
      def,
      folder: null,
      folderPath: null,
      hasContent: false,
      title: def.title,
      hook: null,
      summary: null,
      bodyHtml: null,
      frontmatter: {},
      media: [],
      diagrams: [],
      cover: null,
      statusLabel,
    };
  }

  const folderPath = path.join(CONTENT_ROOT, folder);
  const readmeCandidates = ['README.md', 'readme.md', 'index.md'];
  let raw: string | null = null;
  for (const cand of readmeCandidates) {
    raw = readText(path.join(folderPath, cand));
    if (raw) break;
  }

  const { data, body: rawBody } = raw ? parseFrontmatter(raw) : { data: {} as Frontmatter, body: '' };
  const excluded = excludeSet(data);
  const { media, diagrams } = listMediaFiles(folderPath, folder, excluded);
  const cover = pickCover(data, media, diagrams, folder);

  const hook = fmString(data, 'hook') || extractHook(rawBody) || null;
  let body = stripHookLines(stripLeadingH1(rawBody));
  body = replaceMermaidFences(body, diagrams);
  if (folder.includes('comparator')) body = stripPorts(body);

  const title = fmString(data, 'title') || def.title;
  const summary = hook || fmString(data, 'summary') || fmString(data, 'description');
  const bodyHtml = body.trim() ? await mdToHtml(body) : null;

  return {
    def,
    folder,
    folderPath,
    hasContent: Boolean(body.trim() || media.length || diagrams.length),
    title,
    hook,
    summary,
    bodyHtml,
    frontmatter: data,
    media,
    diagrams,
    cover,
    statusLabel,
  };
}

export async function loadAllProjects(): Promise<ProjectContent[]> {
  return Promise.all(PROJECTS.map(loadProject));
}

function findFile(dir: string, names: string[]): string | null {
  for (const n of names) {
    const p = path.join(dir, n);
    if (exists(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

export async function loadAbout(): Promise<AboutContent> {
  const aboutDir = path.join(CONTENT_ROOT, 'about');
  const empty: AboutContent = {
    hasBio: false,
    bioHtml: null,
    headshotRelUrl: null,
    email: null,
    links: [],
    resumeHref: null,
    github: siteConfig.github,
  };
  if (!exists(aboutDir) || !fs.statSync(aboutDir).isDirectory()) return empty;

  const bioPath = findFile(aboutDir, ['bio.md', 'README.md', 'readme.md', 'about.md', 'index.md']);
  let bioHtml: string | null = null;
  let frontmatter: Frontmatter = {};
  if (bioPath) {
    const raw = readText(bioPath) || '';
    const parsed = parseFrontmatter(raw);
    frontmatter = parsed.data;
    const md = stripLeadingH1(parsed.body);
    if (md.trim()) bioHtml = await mdToHtml(md);
  }

  const headshot = findFile(aboutDir, [
    'headshot.jpg',
    'headshot.jpeg',
    'headshot.png',
    'headshot.webp',
    'photo.jpg',
    'photo.png',
  ]);
  const headshotRelUrl = headshot
    ? `/content/about/${encodeURIComponent(path.basename(headshot))}`
    : null;

  const email = fmString(frontmatter, 'email') || siteConfig.email;
  const resumeHref = fmString(frontmatter, 'resume') || fmString(frontmatter, 'resume_url') || siteConfig.resume;
  const github = fmString(frontmatter, 'github') || siteConfig.github;
  const linkedin = fmString(frontmatter, 'linkedin') || siteConfig.linkedin;

  const links: { label: string; href: string }[] = [];
  if (github) links.push({ label: 'GitHub', href: github });
  if (linkedin) links.push({ label: 'LinkedIn', href: linkedin });

  for (const [k, v] of Object.entries(frontmatter)) {
    if (['email', 'resume', 'resume_url', 'title', 'name', 'github', 'linkedin', 'exclude', 'cover', 'hook'].includes(k)) {
      continue;
    }
    if (typeof v === 'string' && (/^https?:\/\//i.test(v) || v.startsWith('mailto:'))) {
      if (!links.some((l) => l.href === v)) links.push({ label: k, href: v });
    }
  }

  const contactMd = findFile(CONTENT_ROOT, ['contact.md', 'CONTACT.md']);
  if (contactMd) {
    const { data } = parseFrontmatter(readText(contactMd) || '');
    // only add present fields — never invent
    const cEmail = fmString(data, 'email');
    // email override handled below
    void cEmail;
    for (const [k, v] of Object.entries(data)) {
      if (typeof v !== 'string') continue;
      if (k === 'email') continue;
      if (/^https?:\/\//i.test(v) || v.startsWith('mailto:')) {
        if (!links.some((l) => l.href === v)) links.push({ label: k, href: v });
      }
    }
  }

  return {
    hasBio: Boolean(bioHtml),
    bioHtml,
    headshotRelUrl,
    email: email || (contactMd ? fmString(parseFrontmatter(readText(contactMd) || '').data, 'email') : null),
    links,
    resumeHref,
    github,
  };
}

function listFolderImages(folderPath: string, folderRel: string, excluded: Set<string> = new Set()): MediaItem[] {
  const out: MediaItem[] = [];
  if (!exists(folderPath)) return out;
  const parts = folderRel.split('/').map(encodeURIComponent).join('/');
  for (const name of fs.readdirSync(folderPath)) {
    if (excluded.has(name.toLowerCase())) continue;
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const full = path.join(folderPath, name);
    if (!fs.statSync(full).isFile()) continue;
    out.push({
      name,
      relUrl: `/content/${parts}/${encodeURIComponent(name)}`,
      kind: 'image',
    });
  }
  // Prefer lead-like names first for ignite
  out.sort((a, b) => {
    const lead = 'capacitive-cell-charge-discharge.png';
    if (a.name === lead) return -1;
    if (b.name === lead) return 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

function labelFromFolder(folder: string): string {
  return folder
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Parse timeline.md into entries (document order). */
function parseTimelineEntries(md: string): Omit<TimelineEntry, 'folder' | 'thumb'>[] {
  const entries: Omit<TimelineEntry, 'folder' | 'thumb'>[] = [];
  let period = '';
  for (const line of md.split(/\r?\n/)) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      period = h2[1].trim();
      continue;
    }
    const em = line.match(/^\*\*(.+?)\*\*\s*—\s*(.+)$/);
    if (em && period) {
      entries.push({
        period,
        title: em[1].trim(),
        blurb: em[2].replace(/\*\*/g, '').trim(),
      });
    }
  }
  return entries;
}

function matchFolderToEntry(folder: string, entries: { title: string; blurb: string }[]): string | null {
  const tokens = folder.toLowerCase().split(/[-_]/).filter((t) => t.length > 2);
  // special aliases
  const aliases: Record<string, string[]> = {
    ignite: ['ignite', 'litelock'],
    'canada-drive': ['canada'],
    mittic: ['mittic'],
    build4good: ['build4good', 'b4g', 'pokerbot'],
    lunabotics: ['lunabotics'],
    lucidscan: ['lucidscan'],
    samsung: ['samsung'],
    'rev-silicon': ['rev silicon', 'polite'],
    'narayanan-research': ['narayanan', 'gendiff', 'llmzip'],
    'imm-winter-sprint': ['winter sprint', 'comparator winter'],
    'vector-marketing': ['vector marketing'],
    'minecraft-server': ['minecraft'],
  };
  const keys = aliases[folder] || tokens;
  for (const e of entries) {
    const hay = `${e.title} ${e.blurb}`.toLowerCase();
    if (keys.some((k) => hay.includes(k))) return e.title;
  }
  return null;
}

export async function loadTimeline(): Promise<TimelineContent> {
  const mdPath = path.join(CONTENT_ROOT, 'timeline.md');
  const timelineDir = path.join(CONTENT_ROOT, 'timeline');
  let bodyHtml: string | null = null;
  let rawMd = '';
  if (exists(mdPath)) {
    rawMd = readText(mdPath) || '';
    if (rawMd.trim()) bodyHtml = await mdToHtml(rawMd);
  }

  const parsed = parseTimelineEntries(rawMd);
  const galleries: TimelineGallery[] = [];
  const folderByTitle = new Map<string, string>();

  if (exists(timelineDir)) {
    for (const name of fs.readdirSync(timelineDir)) {
      const full = path.join(timelineDir, name);
      if (!fs.statSync(full).isDirectory()) continue;
      const images = listFolderImages(full, `timeline/${name}`);
      if (images.length === 0) continue;
      const matched = matchFolderToEntry(name, parsed);
      if (matched) folderByTitle.set(matched, name);
      galleries.push({
        folder: name,
        label: labelFromFolder(name),
        lead: images[0] || null,
        media: images,
        matchedEntryTitle: matched,
      });
    }
  }

  const entries: TimelineEntry[] = parsed.map((e) => {
    const folder = folderByTitle.get(e.title) || null;
    let thumb: MediaItem | null = null;
    if (folder) {
      const g = galleries.find((x) => x.folder === folder);
      thumb = g?.lead || null;
    }
    return { ...e, folder, thumb };
  });

  // newest first for teaser (document ends with latest periods)
  const teaserEntries = [...entries].reverse().slice(0, 5);

  return {
    hasTimeline: Boolean(bodyHtml),
    bodyHtml,
    entries,
    galleries,
    teaserEntries,
  };
}

/** Kept for pages that still call it; prebuild sync is authoritative. */
export function syncContentToPublic(): void {
  // no-op during page render — sync runs in prebuild / astro integration
}
