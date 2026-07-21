export const CHATIKA_EMOJIS = [
  { code: ':chatika_wave:', label: 'Chatika wave', glyph: '✦', variant: 'wave' },
  { code: ':chatika_glow:', label: 'Chatika glow', glyph: '●', variant: 'glow' },
  { code: ':chatika_together:', label: 'Chatika together', glyph: '∞', variant: 'together' },
  { code: ':chatika_quiet:', label: 'Chatika quiet', glyph: '◌', variant: 'quiet' },
  { code: ':chatika_love:', label: 'Chatika love', glyph: '♥', variant: 'love' },
  { code: ':chatika_spark:', label: 'Chatika spark', glyph: '✧', variant: 'spark' }
];

export function findChatikaEmoji(code) {
  return CHATIKA_EMOJIS.find((emoji) => emoji.code === code);
}
