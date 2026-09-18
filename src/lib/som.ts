/**
 * Bipe e vibração do Cronômetro — o sinal que avisa que a contagem começou.
 *
 * Tudo tolerante a falha: navegador sem Web Audio ou sem vibração (iOS
 * Safari, por exemplo) apenas segue sem o efeito, sem quebrar o jogo.
 */

export function tocarBipe() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 880;
    ganho.gain.setValueAtTime(0.0001, ctx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

    osc.connect(ganho);
    ganho.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => void ctx.close();
  } catch {
    /* sem suporte a áudio: segue sem som */
  }
}

export function vibrar(padrao: number | number[] = 200) {
  try {
    navigator.vibrate?.(padrao);
  } catch {
    /* sem suporte a vibração */
  }
}
