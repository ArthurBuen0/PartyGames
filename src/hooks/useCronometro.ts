import { useEffect, useRef, useState } from "react";

/**
 * Conta o tempo que falta usando o relógio do SERVIDOR.
 *
 * O banco grava `turno_fim` como timestamp absoluto; aqui a gente só corrige o
 * desvio do relógio do aparelho e conta para trás. Isso resolve dois problemas
 * de uma vez: todo mundo vê o mesmo número, e adiantar o relógio do celular não
 * dá vantagem nenhuma (quem valida o fim do tempo é o Postgres).
 *
 * `aoExpirar` dispara uma única vez por prazo — sem isso, doze celulares
 * chamariam a mesma função doze vezes por segundo.
 */
export function useCronometro(
  turnoFim: string | null | undefined,
  desvioRelogio: number,
  aoExpirar?: () => void
): { segundos: number; total: number; expirado: boolean } {
  const [segundos, setSegundos] = useState(0);
  const jaAvisouRef = useRef<string | null>(null);
  const aoExpirarRef = useRef(aoExpirar);
  aoExpirarRef.current = aoExpirar;

  const [totalInicial, setTotalInicial] = useState(0);

  useEffect(() => {
    if (!turnoFim) {
      setSegundos(0);
      setTotalInicial(0);
      return;
    }

    const fim = new Date(turnoFim).getTime();

    const calcular = () => {
      const agoraServidor = Date.now() + desvioRelogio;
      const restante = Math.max(0, Math.ceil((fim - agoraServidor) / 1000));
      setSegundos(restante);

      // Guarda o maior valor visto para desenhar a barra/anel de progresso
      setTotalInicial((atual) => (restante > atual ? restante : atual));

      if (restante === 0 && jaAvisouRef.current !== turnoFim) {
        jaAvisouRef.current = turnoFim;
        aoExpirarRef.current?.();
      }
    };

    calcular();
    const id = setInterval(calcular, 250);
    return () => clearInterval(id);
  }, [turnoFim, desvioRelogio]);

  // Prazo novo, contador novo
  useEffect(() => {
    setTotalInicial(0);
  }, [turnoFim]);

  return {
    segundos,
    total: totalInicial || segundos,
    expirado: Boolean(turnoFim) && segundos === 0
  };
}
