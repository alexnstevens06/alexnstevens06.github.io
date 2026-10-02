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
  /** When true, render on a dark matte (light schematics / transparent logos). */
  needsMatte?: boolean;
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
  /** Linked project deep-dive when the entry maps to a known project. */
  projectSlug: string | null;
};

export type TimelineGallery = {
  folder: string;
  label: string;
  lead: MediaItem | null;
  media: MediaItem[];
  matchedEntryTitle: string | null;
  /** Gallery figures should use a dark matte background. */
  useMatte: boolean;
  projectSlug: string | null;
};

export type TimelineContent = {
  hasTimeline: boolean;
  bodyHtml: string | null;
  entries: TimelineEntry[];
  galleries: TimelineGallery[];
  /** Home teaser: representative span across years (not newest-N). */
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
  return md.replace(/^\s*#\s+[^\n]+\n+/, '');
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
  // README frontmatter wins; otherwise the headline cover listed in content/timeline/COVERS.md.
  const coverName = fmString(data, 'cover') || loadTimelineCovers().get(path.basename(folderRel).toLowerCase()) || null;
  if (coverName) {
    const found =
      media.find((m) => m.name === coverName || m.name.toLowerCase() === coverName.toLowerCase()) ||
      diagrams.find((m) => m.name === coverName || m.name.toLowerCase() === coverName.toLowerCase());
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
  // Prefer architecture / datapath diagrams as headline when present (e.g. Comparator).
  const arch = diagrams.find((d) => {
    const stem = path.basename(d.name, path.extname(d.name)).toLowerCase();
    return stem === 'architecture' || stem === 'datapath';
  });
  if (arch) return arch;
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
  let cover = pickCover(data, media, diagrams, folder);

  // Ignite: force capacitive lead as cover when present; matte light/transparent assets.
  const folderBase = path.basename(folder).toLowerCase();
  if (folderBase === 'ignite' || folder.includes('timeline/ignite')) {
    const igniteLead = 'capacitive-cell-charge-discharge.png';
    const lead = media.find((m) => m.name === igniteLead || m.name.toLowerCase() === igniteLead);
    if (lead) cover = lead;
    for (const m of media) m.needsMatte = true;
    if (cover) cover.needsMatte = true;
  }

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

const IGNITE_LEAD = 'capacitive-cell-charge-discharge.png';

/** Explicit Ignite skips (COVERS.md): blank/white-on-white at thumb size. */
const IGNITE_SKIP = new Set([
  'litelock-logo.png',
  'monostable-capacitor-waveforms.png',
]);

/** Folders whose gallery images should render on a dark matte by default. */
const MATTE_FOLDERS = new Set(['ignite']);

/**
 * Heuristic: skip near-blank / near-white raster images that read as empty boxes.
 * Keeps SVGs and the designated Ignite lead. Uses raw-byte sampling (no native deps).
 */
function imageLooksNearBlank(filePath: string, name: string): boolean {
  const lower = name.toLowerCase();
  if (lower === IGNITE_LEAD) return false;
  const ext = path.extname(lower);
  if (ext === '.svg') return false;
  if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return false;
  let buf: Buffer;
  try {
    buf = fs.readFileSync(filePath);
  } catch {
    return false;
  }
  if (buf.length < 64) return true;
  // Sample evenly across the file (compressed bytes ≈ brightness proxy for flat white PNGs).
  const samples: number[] = [];
  const step = Math.max(1, Math.floor(buf.length / 4000));
  for (let i = 0; i < buf.length; i += step) samples.push(buf[i]);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  let varSum = 0;
  for (const s of samples) varSum += (s - mean) * (s - mean);
  const variance = varSum / samples.length;
  // Very high mean + very low variance ⇒ nearly solid light / empty.
  if (mean > 245 && variance < 80) return true;
  return false;
}

function pngHasAlpha(filePath: string): boolean {
  try {
    const buf = fs.readFileSync(filePath);
    // PNG IHDR color type at byte 25: 4 or 6 ⇒ alpha
    if (buf.length > 26 && buf[0] === 0x89 && buf[1] === 0x50) {
      const colorType = buf[25];
      return colorType === 4 || colorType === 6;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function listFolderImages(folderPath: string, folderRel: string, excluded: Set<string> = new Set()): MediaItem[] {
  const out: MediaItem[] = [];
  if (!exists(folderPath)) return out;
  const folderBase = path.basename(folderPath).toLowerCase();
  const forceMatte = MATTE_FOLDERS.has(folderBase);
  const parts = folderRel.split('/').map(encodeURIComponent).join('/');
  for (const name of fs.readdirSync(folderPath)) {
    if (excluded.has(name.toLowerCase())) continue;
    if (IGNITE_SKIP.has(name.toLowerCase())) continue;
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const full = path.join(folderPath, name);
    if (!fs.statSync(full).isFile()) continue;
    if (imageLooksNearBlank(full, name)) continue;
    const needsMatte = forceMatte || (ext === '.png' && pngHasAlpha(full));
    out.push({
      name,
      relUrl: `/content/${parts}/${encodeURIComponent(name)}`,
      kind: 'image',
      needsMatte,
    });
  }
  // Prefer designated Ignite lead, then alpha
  out.sort((a, b) => {
    if (a.name === IGNITE_LEAD) return -1;
    if (b.name === IGNITE_LEAD) return 1;
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

/** Extract first existing project slug from a timeline blurb (`→ projects/<slug>`). */
function projectSlugFromBlurb(blurb: string): string | null {
  const re = /→\s*`projects\/([a-z0-9-]+)`/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blurb)) !== null) {
    const slug = m[1].toLowerCase();
    if (PROJECTS.some((p) => p.slug === slug)) return slug;
  }
  return null;
}

/** Parse timeline.md into entries (document order). */
function parseTimelineEntries(md: string): Omit<TimelineEntry, 'folder' | 'thumb' | 'projectSlug'>[] {
  const entries: Omit<TimelineEntry, 'folder' | 'thumb' | 'projectSlug'>[] = [];
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
    'imm-winter-sprint': ['winter sprint', 'comparator', 'imm comparator'],
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

/** Map a timeline entry to a project slug when discoverable. */
function matchProjectSlug(title: string, blurb: string, folder: string | null): string | null {
  const hay = `${title} ${blurb} ${folder || ''}`.toLowerCase();
  const rules: { slug: string; keys: string[] }[] = [
    { slug: "ignite", keys: ["ignite", "litelock"] },
    { slug: "lucidscan", keys: ["lucidscan"] },
    { slug: "comparator", keys: ["comparator", "super sprint", "imm comparator", "imm tooling"] },
    { slug: "gendiff-llmzip", keys: ["narayanan", "gendiff", "llmzip"] },
    { slug: "polite", keys: ["rev silicon", "reveille", "polite"] },
    { slug: "splendid-hopper", keys: ["splendid hopper", "vulkan"] },
    { slug: "aggie-scheduler", keys: ["aggie scheduler"] },
    { slug: "ecen-350-cpu", keys: ["ecen 350", "ecen-350"] },
    { slug: "study-lens", keys: ["study lens"] },
    { slug: "class-figures", keys: ["class figures"] },
  ];
  for (const r of rules) {
    if (r.keys.some((k) => hay.includes(k))) {
      if (PROJECTS.some((p) => p.slug === r.slug)) return r.slug;
    }
  }
  return null;
}

/**
 * Optional content/timeline/COVERS.md — maps folder → cover filename.
 * Accepted lines: `folder: filename.png` or `- folder: filename.png`
 * Ignored until the file appears; then those covers become timeline headlines.
 */
function loadTimelineCovers(): Map<string, string> {
  const map = new Map<string, string>();
  const candidates = [
    path.join(CONTENT_ROOT, 'timeline', 'COVERS.md'),
    path.join(CONTENT_ROOT, 'timeline', 'covers.md'),
  ];
  const remember = (key: string, filePath: string) => {
    const k = key.trim().toLowerCase();
    let fp = filePath.trim().replace(/^['"]|['"]$/g, '');
    if (fp.startsWith('`') && fp.endsWith('`')) fp = fp.slice(1, -1);
    if (!k || !fp || k.startsWith('#')) return;
    const base = path.basename(fp);
    map.set(k, base);
    const parts = fp.split('/').filter(Boolean);
    if (parts.length >= 2) map.set(parts[parts.length - 2].toLowerCase(), base);
  };
  for (const pth of candidates) {
    if (!exists(pth)) continue;
    const raw = readText(pth) || '';
    for (const line of raw.split(/\r?\n/)) {
      if (line.includes('|')) {
        const ticks = [...line.matchAll(/`([^`]+)`/g)].map((x) => x[1]);
        if (ticks.length >= 2) {
          const keyCell =
            ticks.find((x) => /projects\/|timeline\//.test(x) && !/\.(png|jpe?g|svg|webp)$/i.test(x)) ||
            ticks[0];
          const coverCell = ticks.find((x) => /\.(png|jpe?g|svg|webp)$/i.test(x));
          if (keyCell && coverCell) {
            const slug = keyCell.replace(/^(projects|timeline)\//, '').split('/')[0];
            remember(slug, coverCell);
            remember(keyCell.replace(/^(projects|timeline)\//, ''), coverCell);
          }
        }
        continue;
      }
      const mm = line.match(/^\s*-?\s*([A-Za-z0-9_\/-]+)\s*:\s*(.+?)\s*$/);
      if (!mm) continue;
      remember(mm[1].replace(/^(projects|timeline)\//, ''), mm[2]);
    }
    break;
  }
  return map;
}

function resolveEntryThumb(
  folder: string | null,
  galleries: TimelineGallery[],
  covers: Map<string, string>,
  projectSlug: string | null,
): MediaItem | null {
  if (folder) {
    const coverName = covers.get(folder.toLowerCase());
    const g = galleries.find((x) => x.folder === folder);
    if (coverName && g) {
      const found = g.media.find((m) => m.name === coverName || m.name.toLowerCase() === coverName.toLowerCase());
      if (found) return found;
      // Cover named in COVERS.md but maybe filtered — still expose URL if file exists
      const full = path.join(CONTENT_ROOT, 'timeline', folder, coverName);
      if (exists(full)) {
        const parts = `timeline/${folder}`.split('/').map(encodeURIComponent).join('/');
        return {
          name: coverName,
          relUrl: `/content/${parts}/${encodeURIComponent(coverName)}`,
          kind: 'image',
          needsMatte: MATTE_FOLDERS.has(folder.toLowerCase()),
        };
      }
    }
    if (g?.lead) return g.lead;
  }
  // Fall back to linked project's cover (e.g. LucidScan with no timeline folder images)
  if (projectSlug) {
    const def = PROJECTS.find((p) => p.slug === projectSlug);
    if (def) {
      const folderName = resolveProjectFolder(def);
      if (folderName) {
        const folderPath = path.join(CONTENT_ROOT, folderName);
        const readmeCandidates = ['README.md', 'readme.md', 'index.md'];
        let raw: string | null = null;
        for (const cand of readmeCandidates) {
          raw = readText(path.join(folderPath, cand));
          if (raw) break;
        }
        const { data } = raw ? parseFrontmatter(raw) : { data: {} as Frontmatter };
        const excluded = excludeSet(data);
        const { media, diagrams } = listMediaFiles(folderPath, folderName, excluded);
        return pickCover(data, media, diagrams, folderName);
      }
    }
  }
  return null;
}

/**
 * Home teaser: span Summer 2024 → latest, not newest-five.
 * One representative per major period, capped ~4, chronological.
 */
function pickTeaserSpan(entries: TimelineEntry[]): TimelineEntry[] {
  if (entries.length === 0) return [];
  const byPeriod = new Map<string, TimelineEntry>();
  for (const e of entries) {
    if (!byPeriod.has(e.period)) byPeriod.set(e.period, e);
  }
  const periodReps = [...byPeriod.values()];
  if (periodReps.length <= 4) return periodReps;

  // Prefer entries that link a project or have a cover, still spanning first→last.
  const scored = periodReps.map((e, i) => ({
    e,
    i,
    score: (e.thumb ? 2 : 0) + (e.projectSlug ? 2 : 0) + (i === 0 || i === periodReps.length - 1 ? 3 : 0),
  }));
  // Always keep first and last period
  const chosenIdx = new Set<number>([0, periodReps.length - 1]);
  const mid = scored
    .filter((s) => s.i !== 0 && s.i !== periodReps.length - 1)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  for (const s of mid) {
    if (chosenIdx.size >= 4) break;
    chosenIdx.add(s.i);
  }
  // If still short, fill evenly
  if (chosenIdx.size < 4) {
    const step = (periodReps.length - 1) / 3;
    for (let k = 0; k < 4 && chosenIdx.size < 4; k++) {
      chosenIdx.add(Math.round(k * step));
    }
  }
  return [...chosenIdx].sort((a, b) => a - b).map((i) => periodReps[i]);
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
  const covers = loadTimelineCovers();
  const galleries: TimelineGallery[] = [];
  const folderByTitle = new Map<string, string>();

  if (exists(timelineDir)) {
    for (const name of fs.readdirSync(timelineDir)) {
      const full = path.join(timelineDir, name);
      if (!fs.statSync(full).isDirectory()) continue;
      // Prefer README frontmatter cover inside the folder when present
      let excluded = new Set<string>();
      let fmCover: string | null = null;
      for (const cand of ['README.md', 'readme.md', 'index.md']) {
        const raw = readText(path.join(full, cand));
        if (!raw) continue;
        const { data } = parseFrontmatter(raw);
        excluded = excludeSet(data);
        fmCover = fmString(data, 'cover');
        break;
      }
      let images = listFolderImages(full, `timeline/${name}`, excluded);
      // Apply COVERS.md / frontmatter cover as lead
      const coverName = covers.get(name.toLowerCase()) || fmCover;
      if (coverName) {
        const idx = images.findIndex(
          (m) => m.name === coverName || m.name.toLowerCase() === coverName.toLowerCase(),
        );
        if (idx > 0) {
          const [c] = images.splice(idx, 1);
          images = [c, ...images];
        } else if (idx === -1) {
          const coverFull = path.join(full, coverName);
          if (exists(coverFull)) {
            const parts = `timeline/${name}`.split('/').map(encodeURIComponent).join('/');
            images = [
              {
                name: coverName,
                relUrl: `/content/${parts}/${encodeURIComponent(coverName)}`,
                kind: 'image',
                needsMatte: MATTE_FOLDERS.has(name.toLowerCase()),
              },
              ...images,
            ];
          }
        }
      }
      if (images.length === 0) continue;
      const matched = matchFolderToEntry(name, parsed);
      if (matched) folderByTitle.set(matched, name);
      const projectSlug = matchProjectSlug(matched || name, '', name);
      galleries.push({
        folder: name,
        label: labelFromFolder(name),
        lead: images[0] || null,
        media: images,
        matchedEntryTitle: matched,
        useMatte: MATTE_FOLDERS.has(name.toLowerCase()) || images.some((m) => m.needsMatte),
        projectSlug,
      });
    }
  }

  const entries: TimelineEntry[] = parsed.map((e) => {
    const folder = folderByTitle.get(e.title) || null;
    const projectSlug = projectSlugFromBlurb(e.blurb) || matchProjectSlug(e.title, e.blurb, folder);
    const thumb = resolveEntryThumb(folder, galleries, covers, projectSlug);
    return { ...e, folder, thumb, projectSlug };
  });

  const teaserEntries = pickTeaserSpan(entries);

  return {
    hasTimeline: entries.length > 0 || Boolean(bodyHtml),
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

/* ───────────── Single-timeline home (v5) ───────────── */

export type HomeEntry = {
  title: string;
  /** ISO YYYY-MM-DD; used for newest-first ordering. */
  date: string;
  period: string;
  /** Inline HTML (from markdown) — one or two sentences. */
  bodyHtml: string;
  cover: MediaItem | null;
  href: string | null;
};

const SEASON_MONTH: Record<string, string> = { winter: '12', spring: '02', summer: '06', fall: '09', autumn: '09' };

/** Resolve a content-relative cover path (`projects/x/y.jpg`); missing/excluded/`none` → null. */
function resolveCoverPath(raw: string | undefined): MediaItem | null {
  if (!raw) return null;
  const rel = raw.trim().replace(/^`|`$/g, '').replace(/^\/?(content\/)?/, '');
  if (!rel || /^none$/i.test(rel)) return null;
  const name = path.basename(rel);
  const lower = name.toLowerCase();
  if (DEFAULT_MEDIA_EXCLUDE.includes(lower) || IGNITE_SKIP.has(lower)) return null;
  const ext = path.extname(lower);
  if (!IMAGE_EXT.has(ext)) return null;
  const full = path.join(CONTENT_ROOT, rel);
  if (!full.startsWith(CONTENT_ROOT + path.sep) || !exists(full) || !fs.statSync(full).isFile()) return null;
  const folder = path.dirname(rel);
  const needsMatte =
    MATTE_FOLDERS.has(path.basename(folder).toLowerCase()) || (ext === '.png' && pngHasAlpha(full));
  return {
    name,
    relUrl: `/content/${rel.split('/').map(encodeURIComponent).join('/')}`,
    kind: 'image',
    needsMatte,
  };
}

/** `projects/polite` → `/projects/polite/` when that project page exists; else null. */
function resolveLink(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().replace(/^`|`$/g, '');
  if (!v || /^none$/i.test(v)) return null;
  const m = v.match(/^\/?projects\/([a-z0-9-]+)\/?$/i);
  if (m && PROJECTS.some((p) => p.slug === m[1].toLowerCase())) return `/projects/${m[1].toLowerCase()}/`;
  return null;
}

async function inlineMd(md: string): Promise<string> {
  return (marked.parseInline(md.trim(), { async: true, gfm: true }) as Promise<string>);
}

/**
 * Strict format (one block per entry):
 *   ### Title
 *   date: YYYY-MM-DD
 *   period: Sep 2026 to present
 *   cover: projects/polite/block_diagram.jpg   (or none)
 *   link: projects/polite                      (or none)
 *
 *   Body sentence(s).
 */
function parseStrictTimeline(md: string): { title: string; fields: Record<string, string>; body: string }[] {
  const out: { title: string; fields: Record<string, string>; body: string }[] = [];
  const blocks = md.split(/^###\s+/m).slice(1);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const title = lines.shift()!.trim();
    const fields: Record<string, string> = {};
    const bodyLines: string[] = [];
    let inFields = true;
    for (const line of lines) {
      const f = inFields && line.match(/^(date|period|cover|link)\s*:\s*(.*?)\s*$/i);
      if (f) {
        fields[f[1].toLowerCase()] = f[2].replace(/\s+\(or none\)$/i, '');
        continue;
      }
      if (inFields && !line.trim()) continue;
      inFields = false;
      if (/^#{1,2}\s/.test(line)) break; // stop at a higher-level heading
      bodyLines.push(line);
    }
    out.push({ title, fields, body: bodyLines.join('\n').trim() });
  }
  return out;
}

/** Best-effort ISO date from a legacy period heading like "Fall 2025" or "Winter break 2025–2026". */
function dateFromPeriod(period: string): string {
  const year = period.match(/(20\d\d)/)?.[1] ?? '2000';
  const season = Object.keys(SEASON_MONTH).find((s) => period.toLowerCase().includes(s));
  return `${year}-${season ? SEASON_MONTH[season] : '01'}-01`;
}

export async function loadHomeTimeline(): Promise<HomeEntry[]> {
  const raw = readText(path.join(CONTENT_ROOT, 'timeline.md')) || '';
  const entries: HomeEntry[] = [];
  const order = new Map<HomeEntry, number>();
  const add = (e: HomeEntry) => {
    order.set(e, order.size);
    entries.push(e);
  };

  if (/^###\s+/m.test(raw)) {
    for (const e of parseStrictTimeline(raw)) {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(e.fields.date || '') ? e.fields.date : '0000-00-00';
      add({
        title: e.title,
        date,
        period: e.fields.period || '',
        bodyHtml: e.body ? await inlineMd(e.body.replace(/\s*\n\s*/g, ' ')) : '',
        cover: resolveCoverPath(e.fields.cover),
        href: resolveLink(e.fields.link),
      });
    }
  } else if (raw.trim()) {
    // Legacy "## Period / **Title** — blurb" format: reuse the v4 resolver.
    const legacy = await loadTimeline();
    for (const e of legacy.entries) {
      const blurb = e.blurb
        .replace(/\s*→\s*`[^`]*`(,\s*`[^`]*`)*/g, '')
        .replace(/\s*Cover:\s*`[^`]*`\s*(\([^)]*\))?\.?/gi, '')
        .trim();
      add({
        title: e.title,
        date: dateFromPeriod(e.period),
        period: e.period,
        bodyHtml: await inlineMd(blurb),
        cover: e.thumb,
        href: e.projectSlug ? `/projects/${e.projectSlug}/` : null,
      });
    }
  }

  // Newest first; for equal dates, later-in-document first for legacy (chronological) files,
  // document order for strict files (already written newest-first).
  const strict = /^###\s+/m.test(raw);
  entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const d = order.get(a)! - order.get(b)!;
    return strict ? d : -d;
  });
  return entries;
}

/** First sentence of the about bio (plain text), for the one-line header. */
export function loadBioLine(): string | null {
  const bioPath = findFile(path.join(CONTENT_ROOT, 'about'), ['bio.md', 'README.md', 'readme.md', 'about.md', 'index.md']);
  if (!bioPath) return null;
  const body = stripLeadingH1(parseFrontmatter(readText(bioPath) || '').body);
  const para = body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^[#>|-]/.test(p));
  if (!para) return null;
  const plain = para.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ');
  const m = plain.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : plain).trim();
}
