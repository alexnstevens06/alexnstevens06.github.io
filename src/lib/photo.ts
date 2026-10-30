/**
 * Photographs get the greyscale plate. Diagrams, charts, logos, and
 * screenshots stay in their original color so the figures remain readable.
 * Add a filename here only when the asset is an actual photograph.
 */
const PHOTO_NAMES = new Set([
  'headshot.jpg',
  'headshot.jpeg',
  'headshot.png',
  'headshot.webp',
  'samsung-austin-group.png',
]);

export function isPhotograph(relUrl: string | null | undefined): boolean {
  if (!relUrl) return false;
  const name = decodeURIComponent(relUrl.split('/').pop() ?? '').toLowerCase();
  return PHOTO_NAMES.has(name);
}
