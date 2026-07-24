// Deterministic default avatar: same user always gets the same color and
// initial, distinct users get visibly different colors (a stable hash of
// their id picks a slot in the palette below) - like Slack/Discord/WhatsApp
// defaults, instead of every user showing the same icon.
const AVATAR_PALETTE = [
  ['#00bccc', '#0a8fa0'],
  ['#2dc39a', '#1a8f6f'],
  ['#f2a51a', '#c97e0a'],
  ['#ff6a5c', '#d4402f'],
  ['#8b7cf6', '#5f4bd6'],
  ['#3aa0ff', '#1a6fd6'],
  ['#ff8fc7', '#d6529a'],
  ['#7fd858', '#4ea82c']
];

function hashSeed(seed) {
  const text = String(seed || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function avatarGradient(seed) {
  const [from, to] = AVATAR_PALETTE[hashSeed(seed) % AVATAR_PALETTE.length];
  return { background: `linear-gradient(135deg, ${from}, ${to})` };
}

export function avatarInitial(username) {
  const trimmed = String(username || '').trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?';
}
