// Players with an "eliminated" portrait in /public/eliminated-images.
// Auto-generated from the image filenames (<Player Name>-eliminated.png).
// Mirrors championImages.ts; used to show the MVP image on the elimination card.

export const ELIMINATED_IMAGE_NAMES: ReadonlySet<string> = new Set([
  "Cristiano Ronaldo",
  "Eusébio",
  "Johan Cruyff",
  "Karim Benzema",
  "Lionel Messi",
  "Neymar",
  "Paolo Maldini",
  "Robert Lewandowski",
  "Ronaldinho",
  "Thibaut Courtois",
  "Virgil van Dijk",
]);

export function hasEliminatedImage(name: string): boolean {
  return ELIMINATED_IMAGE_NAMES.has(name);
}

export function eliminatedImageSrc(name: string): string {
  return `/eliminated-images/${encodeURIComponent(name)}-eliminated.png`;
}
