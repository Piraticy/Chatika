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

// A user can explicitly pick one of these instead of the auto-assigned
// default or an uploaded photo. Persisted as avatar_url = `preset:<id>` via
// the existing profile-update endpoint (backend/app/api/routes_auth.py
// validates the id against this same list) - no separate schema needed.
export const AVATAR_PRESETS = [
  { id: 'p1', glyph: '✦', colors: ['#00bccc', '#0a8fa0'] },
  { id: 'p2', glyph: '●', colors: ['#2dc39a', '#1a8f6f'] },
  { id: 'p3', glyph: '∞', colors: ['#f2a51a', '#c97e0a'] },
  { id: 'p4', glyph: '♥', colors: ['#ff6a5c', '#d4402f'] },
  { id: 'p5', glyph: '✧', colors: ['#8b7cf6', '#5f4bd6'] },
  { id: 'p6', glyph: '◆', colors: ['#3aa0ff', '#1a6fd6'] },
  { id: 'p7', glyph: '★', colors: ['#ff8fc7', '#d6529a'] },
  { id: 'p8', glyph: '▲', colors: ['#7fd858', '#4ea82c'] },
  { id: 'p9', glyph: '☾', colors: ['#c084fc', '#8b3fd6'] },
  { id: 'p10', glyph: '☀', colors: ['#ffb703', '#e08900'] },
  { id: 'p11', glyph: '❄', colors: ['#38bdf8', '#0284c7'] },
  { id: 'p12', glyph: '✺', colors: ['#fb7185', '#be123c'] }
];

const PRESET_PREFIX = 'preset:';

export function presetAvatarUrl(id) {
  return `${PRESET_PREFIX}${id}`;
}

export function presetFromAvatarUrl(value) {
  if (typeof value !== 'string' || !value.startsWith(PRESET_PREFIX)) return null;
  const id = value.slice(PRESET_PREFIX.length);
  return AVATAR_PRESETS.find((preset) => preset.id === id) || null;
}

export function presetGradient(preset) {
  return { background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})` };
}
