// Chat wallpaper presets: each is a plain CSS `background` shorthand value
// (works as one or more comma-separated layers), so applying a preset is
// just `style.background = preset.css` - no image assets to ship or load.
export const CHAT_BACKGROUNDS = [
  {
    id: 'classic',
    label: 'Classic',
    swatch: 'linear-gradient(135deg, #f7fbff, #eaf2f7)',
    css: null
  },
  {
    id: 'signal-dots',
    label: 'Signal dots',
    swatch: 'radial-gradient(circle, rgba(10,140,150,.4) 1.6px, transparent 1.7px) 0 0/9px 9px, #eef6fa',
    css: 'radial-gradient(circle at center, rgba(10,140,150,.16) 1.6px, transparent 1.7px) 0 0/22px 22px, linear-gradient(180deg, #f5fbfd, #eaf3f6)'
  },
  {
    id: 'coral-bloom',
    label: 'Coral bloom',
    swatch: 'radial-gradient(circle at 30% 20%, rgba(255,138,116,.4), transparent 55%), radial-gradient(circle at 80% 80%, rgba(45,195,154,.35), transparent 55%), #fdf7f5',
    css: 'radial-gradient(circle at 12% 15%, rgba(255,138,116,.16) 0%, transparent 40%), radial-gradient(circle at 85% 25%, rgba(45,195,154,.14) 0%, transparent 42%), radial-gradient(circle at 30% 85%, rgba(139,124,246,.12) 0%, transparent 45%), #fdf9f7'
  },
  {
    id: 'soft-waves',
    label: 'Soft waves',
    swatch: 'repeating-linear-gradient(135deg, rgba(0,188,204,.35) 0 6px, #eef7f9 6px 26px)',
    css: 'repeating-linear-gradient(135deg, rgba(0,188,204,.07) 0px, rgba(0,188,204,.07) 2px, transparent 2px, transparent 26px), #f6fbfc'
  },
  {
    id: 'night-sky',
    label: 'Night sky',
    swatch: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,.5) 1px, transparent 1.4px), radial-gradient(circle at 70% 60%, rgba(255,255,255,.4) 1px, transparent 1.4px), #0d1d2b',
    css: 'radial-gradient(circle at 15% 25%, rgba(255,255,255,.5) 0.9px, transparent 1.3px) 0 0/48px 48px, radial-gradient(circle at 65% 70%, rgba(255,255,255,.35) 0.9px, transparent 1.3px) 0 0/64px 64px, radial-gradient(circle at 92% 0%, rgba(0,240,255,.08), transparent 32%), #0d1d2b'
  }
];

export function chatBackgroundCss(id) {
  return CHAT_BACKGROUNDS.find((entry) => entry.id === id)?.css || null;
}
