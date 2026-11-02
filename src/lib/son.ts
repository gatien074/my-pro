/**
 * Alertes sonores locales (aucun fichier audio à télécharger → 100 % hors ligne).
 * Le son est généré avec l'API Web Audio : indispensable pour une caisse qui
 * doit signaler immédiatement une rupture de stock au caissier.
 */

type ContexteAudio = typeof AudioContext;

function contexteAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: ContexteAudio | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: ContexteAudio }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

function bip(ctx: AudioContext, aPartirDe: number, frequence: number, duree = 0.16): void {
  const oscillateur = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillateur.type = 'square';
  oscillateur.frequency.setValueAtTime(frequence, aPartirDe);

  gain.gain.setValueAtTime(0.0001, aPartirDe);
  gain.gain.exponentialRampToValueAtTime(0.12, aPartirDe + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, aPartirDe + duree);

  oscillateur.connect(gain);
  gain.connect(ctx.destination);
  oscillateur.start(aPartirDe);
  oscillateur.stop(aPartirDe + duree + 0.02);
}

/** Bip court d'erreur / produit introuvable. */
export function jouerSonErreur(): void {
  const ctx = contexteAudio();
  if (!ctx) return;
  try {
    void ctx.resume();
    bip(ctx, ctx.currentTime + 0.01, 320, 0.12);
    bip(ctx, ctx.currentTime + 0.18, 260, 0.14);
    window.setTimeout(() => void ctx.close(), 500);
  } catch {
    void ctx.close().catch(() => undefined);
  }
}

/** Alarme de rupture de stock : trois bips aigus + vibration si disponible. */
export function jouerAlerteStock(): void {
  const ctx = contexteAudio();
  if (!ctx) return;
  try {
    void ctx.resume();
    const t = ctx.currentTime + 0.01;
    bip(ctx, t, 880, 0.14);
    bip(ctx, t + 0.18, 880, 0.14);
    bip(ctx, t + 0.36, 1180, 0.18);
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    void ctx.close().catch(() => undefined);
  }

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([220, 120, 220]);
    } catch {
      // Certains navigateurs refusent la vibration sans geste utilisateur : on ignore.
    }
  }
}
