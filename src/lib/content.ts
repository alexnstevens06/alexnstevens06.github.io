import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { PROJECTS, type ProjectDef } from './projects';

const ROOT = path.resolve(process.cwd());
const CONTENT_ROOT = path.join(ROOT, 'content');

export type Frontmatter = Record<string, string>;

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
  summary: string | null;
  bodyHtml: string | null;
  bodyMarkdown: string | null;
  frontmatter: Frontmatter;
  media: MediaItem[];
  /** Optional status chip, e.g. "Ongoing research" — never invent results claims. */
  statusLabel: string | null;
  architectureSvgRelUrl: string | null;
};

export type AboutContent = {
  hasBio: boolean;
  bioHtml: string | null;
  bioMarkdown: string | null;
  headshotRelUrl: string | null;
  headshotName: string | null;
  email: string | null;
  links: { label: string; href: string }[];
  resumeHref: string | null;
};

export type TimelineContent = {
  hasTimeline: boolean;
  bodyHtml: string | null;
  bodyMarkdown: string | null;
  igniteLead: MediaItem | null;
  igniteMedia: MediaItem[];
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
  if (!trimmed.startsWith('---')) {
    return { data: {}, body: trimmed };
  }
  const end = trimmed.indexOf('\n---', 3);
  if (end === -1) {
    return { data: {}, body: trimmed };
  }
  const fmBlock = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + 4).replace(/^\r?\n/, '');
  const data: Frontmatter = {};
  for (const line of fmBlock.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    data[m[1]] = v;
  }
  return { data, body };
}

async function mdToHtml(md: string): Promise<string> {
  marked.setOptions({ gfm: true, breaks: false });
  return marked.parse(md, { async: true }) as Promise<string>;
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

/** Comparator UI shots allowed in the gallery (exact basename stems). */
const COMPARATOR_GALLERY_STEMS = new Set([
  'research_case',
  'research_list',
  'alerts',
  'research_map',
]);

const COMPARATOR_EXCLUDE_FILES = new Set([
  'home.jpg',
  'home.jpeg',
  'home.png',
  'browser.jpg',
  'browser.jpeg',
  'browser.png',
]);

function stemOf(name: string): string {
  return path.basename(name, path.extname(name));
}

function isComparatorFolder(folderRel: string): boolean {
  return folderRel === 'projects/comparator' || folderRel === 'comparator';
}

function listMedia(folderPath: string, folderRel: string): MediaItem[] {
  const out: MediaItem[] = [];
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(folderPath);
  } catch {
    return out;
  }
  const isComparator = isComparatorFolder(folderRel);
  for (const name of entries) {
    const lower = name.toLowerCase();
    if (isComparator && COMPARATOR_EXCLUDE_FILES.has(lower)) continue;
    // Architecture handled separately (port-stripped SVG)
    if (isComparator && stemOf(name) === 'architecture') continue;
    if (isComparator && !COMPARATOR_GALLERY_STEMS.has(stemOf(name))) continue;

    const ext = path.extname(name).toLowerCase();
    const kind = IMAGE_EXT.has(ext) ? 'image' : VIDEO_EXT.has(ext) ? 'video' : null;
    if (!kind) continue;
    const full = path.join(folderPath, name);
    if (!fs.statSync(full).isFile()) continue;
    const parts = folderRel.split('/').map(encodeURIComponent).join('/');
    out.push({
      name,
      relUrl: `/content/${parts}/${encodeURIComponent(name)}`,
      kind,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function extractSummary(md: string): string | null {
  const lines = md.split(/\r?\n/);
  let i = 0;
  if (lines[0]?.startsWith('# ')) i = 1;
  while (i < lines.length && !lines[i].trim()) i++;
  const chunk: string[] = [];
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) break;
    if (t.startsWith('#')) break;
    chunk.push(t.replace(/\*\*/g, ''));
  }
  const text = chunk.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > 180 ? text.slice(0, 177) + '…' : text;
}

function stripLeadingH1(md: string): string {
  return md.replace(/^#\s+[^\n]+\n+/, '');
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
      summary: null,
      bodyHtml: null,
      bodyMarkdown: null,
      frontmatter: {},
      media: [],
      statusLabel,
      architectureSvgRelUrl: null,
    };
  }
  const folderPath = path.join(CONTENT_ROOT, folder);
  const readmeCandidates = ['README.md', 'readme.md', 'index.md', 'ABOUT.md'];
  let raw: string | null = null;
  for (const cand of readmeCandidates) {
    raw = readText(path.join(folderPath, cand));
    if (raw) break;
  }
  const media = listMedia(folderPath, folder);

  let architectureSvgRelUrl: string | null = null;
  if (isComparatorFolder(folder)) {
    const svgPath = path.join(folderPath, 'architecture.svg');
    if (exists(svgPath)) {
      const parts = folder.split('/').map(encodeURIComponent).join('/');
      architectureSvgRelUrl = `/content/${parts}/architecture.svg`;
    }
  }

  if (!raw) {
    return {
      def,
      folder,
      folderPath,
      hasContent: media.length > 0 || Boolean(architectureSvgRelUrl),
      title: def.title,
      summary: null,
      bodyHtml: null,
      bodyMarkdown: null,
      frontmatter: {},
      media,
      statusLabel,
      architectureSvgRelUrl,
    };
  }
  const { data, body: rawBody } = parseFrontmatter(raw);
  let body = stripLeadingH1(rawBody);
  // Build-time transform for Comparator only: omit local ports from rendered copy.
  if (isComparatorFolder(folder)) {
    body = body.replace(/:61926/g, '').replace(/:3000/g, '');
  }
  const title = data.title || def.title;
  const summary = data.summary || data.description || extractSummary(rawBody);
  const bodyHtml = body.trim() ? await mdToHtml(body) : null;
  return {
    def,
    folder,
    folderPath,
    hasContent: Boolean(body.trim() || media.length || architectureSvgRelUrl),
    title,
    summary,
    bodyHtml,
    bodyMarkdown: body,
    frontmatter: data,
    media,
    statusLabel,
    architectureSvgRelUrl,
  };
}

export async function loadAllProjects(): Promise<ProjectContent[]> {
  return Promise.all(PROJECTS.map(loadProject));
}

function findAboutFile(dir: string, names: string[]): string | null {
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
    bioMarkdown: null,
    headshotRelUrl: null,
    headshotName: null,
    email: null,
    links: [],
    resumeHref: null,
  };
  if (!exists(aboutDir) || !fs.statSync(aboutDir).isDirectory()) {
    return empty;
  }

  const bioPath = findAboutFile(aboutDir, [
    'bio.md',
    'README.md',
    'readme.md',
    'about.md',
    'index.md',
  ]);
  let bioHtml: string | null = null;
  let bioMarkdown: string | null = null;
  let frontmatter: Frontmatter = {};
  if (bioPath) {
    const raw = readText(bioPath) || '';
    const parsed = parseFrontmatter(raw);
    frontmatter = parsed.data;
    bioMarkdown = stripLeadingH1(parsed.body);
    if (bioMarkdown.trim()) bioHtml = await mdToHtml(bioMarkdown);
  }

  const headshot = findAboutFile(aboutDir, [
    'headshot.jpg',
    'headshot.jpeg',
    'headshot.png',
    'headshot.webp',
    'photo.jpg',
    'photo.jpeg',
    'photo.png',
    'avatar.jpg',
    'avatar.png',
  ]);
  let headshotRelUrl: string | null = null;
  let headshotName: string | null = null;
  if (headshot) {
    headshotName = path.basename(headshot);
    headshotRelUrl = `/content/about/${encodeURIComponent(headshotName)}`;
  }

  let email = frontmatter.email || null;
  const resumeHref = frontmatter.resume || frontmatter.resume_url || null;
  const links: { label: string; href: string }[] = [];
  for (const [k, v] of Object.entries(frontmatter)) {
    if (['email', 'resume', 'resume_url', 'title', 'name'].includes(k)) continue;
    if (/^https?:\/\//i.test(v) || v.startsWith('mailto:')) {
      links.push({ label: k, href: v });
    }
  }

  const contactMd = findAboutFile(CONTENT_ROOT, ['contact.md', 'CONTACT.md']);
  if (contactMd) {
    const raw = readText(contactMd) || '';
    const { data } = parseFrontmatter(raw);
    if (data.email && !email) email = data.email;
    for (const [k, v] of Object.entries(data)) {
      if (k === 'email') continue;
      if (/^https?:\/\//i.test(v) || v.startsWith('mailto:')) {
        if (!links.some((l) => l.href === v)) links.push({ label: k, href: v });
      }
    }
  }

  return {
    hasBio: Boolean(bioHtml),
    bioHtml,
    bioMarkdown,
    headshotRelUrl,
    headshotName,
    email,
    links,
    resumeHref,
  };
}

const IGNITE_LEAD = 'capacitive-cell-charge-discharge.png';

export async function loadTimeline(): Promise<TimelineContent> {
  const mdPath = path.join(CONTENT_ROOT, 'timeline.md');
  const igniteDir = path.join(CONTENT_ROOT, 'timeline', 'ignite');
  let bodyMarkdown: string | null = null;
  let bodyHtml: string | null = null;
  if (exists(mdPath)) {
    bodyMarkdown = readText(mdPath);
    if (bodyMarkdown?.trim()) {
      // Keep the document's own H1 ("Timeline") — page uses a visually-hidden or matching title
      bodyHtml = await mdToHtml(bodyMarkdown);
    }
  }

  const igniteMedia: MediaItem[] = [];
  let igniteLead: MediaItem | null = null;
  if (exists(igniteDir) && fs.statSync(igniteDir).isDirectory()) {
    for (const name of fs.readdirSync(igniteDir)) {
      const ext = path.extname(name).toLowerCase();
      if (!IMAGE_EXT.has(ext)) continue;
      const full = path.join(igniteDir, name);
      if (!fs.statSync(full).isFile()) continue;
      const item: MediaItem = {
        name,
        relUrl: `/content/timeline/ignite/${encodeURIComponent(name)}`,
        kind: 'image',
      };
      if (name === IGNITE_LEAD) igniteLead = item;
      else igniteMedia.push(item);
    }
    igniteMedia.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    hasTimeline: Boolean(bodyHtml),
    bodyHtml,
    bodyMarkdown,
    igniteLead,
    igniteMedia,
  };
}

const COMPARATOR_EXCLUDE = new Set([
  'home.jpg',
  'home.jpeg',
  'home.png',
  'browser.jpg',
  'browser.jpeg',
  'browser.png',
  'architecture.png',
]);

const COMPARATOR_MEDIA_ALLOW = new Set([
  'research_case.jpg',
  'research_case.jpeg',
  'research_case.png',
  'research_case.webp',
  'research_list.jpg',
  'research_list.jpeg',
  'research_list.png',
  'research_list.webp',
  'alerts.jpg',
  'alerts.jpeg',
  'alerts.png',
  'alerts.webp',
  'research_map.jpg',
  'research_map.jpeg',
  'research_map.png',
  'research_map.webp',
  'architecture.svg',
  'architecture.mmd',
  'readme.md',
]);

function shouldSkipCopy(relPosix: string): boolean {
  const parts = relPosix.split('/');
  if (parts[0] === 'projects' && parts[1] === 'comparator' && parts[2]) {
    const base = parts[2].toLowerCase();
    if (COMPARATOR_EXCLUDE.has(base)) return true;
    const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
    const isMedia = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.mmd', '.mp4', '.webm'].includes(ext);
    if (isMedia && !COMPARATOR_MEDIA_ALLOW.has(base)) return true;
  }
  return false;
}

function stripPortsInText(text: string): string {
  return text.replace(/:61926/g, '').replace(/:3000/g, '');
}

function copyTreeFiltered(src: string, dest: string, rel = ''): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const relPosix = rel ? `${rel}/${name}` : name;
    const st = fs.statSync(from);
    if (st.isDirectory()) {
      copyTreeFiltered(from, to, relPosix);
      continue;
    }
    if (shouldSkipCopy(relPosix)) continue;
    if (
      relPosix === 'projects/comparator/architecture.mmd' ||
      relPosix === 'projects/comparator/architecture.svg' ||
      relPosix.toLowerCase() === 'projects/comparator/readme.md'
    ) {
      fs.writeFileSync(to, stripPortsInText(fs.readFileSync(from, 'utf8')));
      continue;
    }
    fs.copyFileSync(from, to);
  }
}

/**
 * Copy content/ into public/content/ so assets are served at /content/...
 * Excludes comparator home.jpg / browser.jpg; strips ports from architecture copies.
 */
export function syncContentToPublic(): void {
  const destRoot = path.join(ROOT, 'public', 'content');
  if (exists(destRoot)) {
    fs.rmSync(destRoot, { recursive: true, force: true });
  }
  if (!exists(CONTENT_ROOT)) {
    fs.mkdirSync(destRoot, { recursive: true });
    return;
  }
  fs.mkdirSync(path.dirname(destRoot), { recursive: true });
  copyTreeFiltered(CONTENT_ROOT, destRoot);
}
