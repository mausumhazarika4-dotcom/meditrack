/**
 * Web Audio API gentle reminder chime.
 * Self-contained, no external asset dependencies.
 */
export function playReminderSound() {
  try {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // Pleasant 2-tone melodic chime (E5 -> G#5)
    playTone(659.25, 0, 0.4);
    playTone(830.61, 0.25, 0.6);
  } catch (e) {
    // Audio may be blocked before first user interaction
    console.debug("Web Audio not allowed or error:", e);
  }
}
