/**
 * Effets sonores synthétisés (Web Audio) : aucun fichier à télécharger.
 * Le contexte audio n'est créé qu'après une interaction (exigence des navigateurs).
 */
export type Sfx = "place" | "cast" | "reveal" | "hit" | "heal" | "buff" | "death" | "turn" | "tick" | "win" | "lose" | "error" | "dice";

const MUTE_KEY = "baston:muted";
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(v: boolean): void {
  muted = v;
  try {
    localStorage.setItem(MUTE_KEY, v ? "1" : "0");
  } catch {
    /* ignoré */
  }
  listeners.forEach((fn) => fn());
}

export function onMuteChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Débloque l'audio au premier geste de l'utilisateur. */
export function unlockAudio(): void {
  const once = () => {
    audio();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once);
  window.addEventListener("keydown", once);
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.08, delay = 0, slideTo?: number): void {
  const a = audio();
  if (!a || a.state !== "running") return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, gain = 0.1): void {
  const a = audio();
  if (!a || a.state !== "running") return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(a.destination);
  src.start();
}

export function play(sfx: Sfx): void {
  if (muted) return;
  switch (sfx) {
    case "place":
      return tone(520, 0.08, "triangle", 0.05);
    case "cast":
      tone(330, 0.25, "sawtooth", 0.05, 0, 880);
      return tone(660, 0.2, "triangle", 0.04, 0.08);
    case "reveal":
      [392, 523, 659].forEach((f, i) => tone(f, 0.18, "triangle", 0.05, i * 0.07));
      return;
    case "hit":
      noise(0.12, 0.12);
      return tone(140, 0.18, "square", 0.05, 0, 70);
    case "heal":
      return [659, 880].forEach((f, i) => tone(f, 0.2, "sine", 0.05, i * 0.08));
    case "buff":
      return tone(440, 0.15, "sine", 0.04, 0, 660);
    case "death":
      return tone(220, 0.7, "sawtooth", 0.06, 0, 55);
    case "dice":
      noise(0.05, 0.05);
      return tone(900, 0.04, "square", 0.03, 0.05);
    case "turn":
      return tone(587, 0.15, "triangle", 0.05);
    case "tick":
      return tone(1200, 0.03, "square", 0.02);
    case "win":
      return [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, "triangle", 0.06, i * 0.12));
    case "lose":
      return [392, 330, 262].forEach((f, i) => tone(f, 0.35, "sine", 0.05, i * 0.15));
    case "error":
      return tone(180, 0.12, "square", 0.03);
  }
}

/** Son représentatif d'une étape de rejeu (le plus marquant l'emporte). */
export function sfxForEvents(types: string[]): Sfx | null {
  if (types.includes("PLAYER_DIED")) return "death";
  if (types.includes("DAMAGE") || types.includes("HP_LOST")) return "hit";
  if (types.includes("HEAL")) return "heal";
  if (types.includes("STATUS_APPLIED") || types.includes("SUMMON_ENTERED")) return "buff";
  return null;
}
