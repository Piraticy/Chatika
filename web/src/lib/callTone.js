let activeTone = null;

const RING_PATTERNS = {
  incoming: [
    [523.25, 0, 0.16],
    [659.25, 0.18, 0.18],
    [783.99, 0.42, 0.26],
  ],
  outgoing: [
    [659.25, 0, 0.14],
    [783.99, 0.18, 0.14],
    [1046.5, 0.36, 0.2],
  ],
};

function playTonePhrase(tone, pattern) {
  const { context } = tone;
  if (activeTone !== tone || context.state === 'closed') return;

  const startAt = context.currentTime + 0.02;

  pattern.forEach(([frequency, offset, duration]) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = startAt + offset;
    const noteEnd = noteStart + duration;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.1, noteStart + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.03);
  });
}

export function startChatikaRingtone(kind = 'outgoing') {
  if (typeof window === 'undefined') return;

  stopChatikaRingtone();

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  let context;
  try {
    context = new AudioContext();
  } catch {
    return;
  }

  const pattern = RING_PATTERNS[kind] || RING_PATTERNS.outgoing;
  const tone = { context, intervalId: null };
  activeTone = tone;

  const play = () => playTonePhrase(tone, pattern);
  Promise.resolve(context.resume?.())
    .catch(() => undefined)
    .finally(play);

  tone.intervalId = window.setInterval(play, 2500);
}

export function stopChatikaRingtone() {
  if (!activeTone) return;

  const tone = activeTone;
  activeTone = null;
  window.clearInterval(tone.intervalId);
  tone.context.close().catch(() => undefined);
}
