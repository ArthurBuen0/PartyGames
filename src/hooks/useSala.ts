import { useCallback, useEffect, useRef, useState } from "react";
import { chamar, supabase } from "../lib/supabase";
import type { EstadoPrivado, EstadoSala } from "../lib/tipos";
import { codigoDoErro, traduzirErro } from "../lib/erros";

/**
 * O estado ao vivo da sala.
 *
 * Estratégia deliberada: em vez de aplicar deltas na mão a cada evento do
 * Realtime, a gente escuta as tabelas da sala e, a qualquer mudança, refaz a
 * leitura completa com `estado_da_sala()`. É uma consulta a mais, mas o estado
 * nunca fica "meio atualizado" — o que importa numa mesa de 12 pessoas mexendo
 * ao mesmo tempo. Vários eventos seguidos viram uma única releitura.
 *
 * Os estados privados vêm de uma consulta separada: o RLS já devolve só o que
 * esta pessoa pode ver, então não há filtragem no cliente.
 */

/**
 * As tabelas que o canal escuta, cada uma com a coluna que aponta para a sala.
 *
 * `salas` é a exceção que importa: a sala é identificada por `id`, não por
 * `sala_id`. Filtrar por uma coluna que não existe não dá erro visível — a
 * assinatura ainda responde SUBSCRIBED — mas o canal inteiro para de entregar
 * eventos, inclusive os das outras tabelas. Bug silencioso e caro: a sala fica
 * com cara de congelada.
 */
const TABELAS: ReadonlyArray<{ nome: string; coluna: string }> = [
  { nome: "salas", coluna: "id" },
  { nome: "participantes", coluna: "sala_id" },
  { nome: "partidas", coluna: "sala_id" },
  { nome: "rodadas", coluna: "sala_id" },
  { nome: "estados_privados", coluna: "sala_id" },
  { nome: "envios", coluna: "sala_id" },
  { nome: "votos", coluna: "sala_id" },
  { nome: "avaliacoes", coluna: "sala_id" },
  { nome: "etapas_desenho", coluna: "sala_id" },
  { nome: "pontuacoes", coluna: "sala_id" },
  { nome: "duelos", coluna: "sala_id" }
];

export interface SalaAoVivo {
  estado: EstadoSala | null;
  privados: EstadoPrivado[];
  carregando: boolean;
  erro: string | null;
  /** Código cru do erro (ex.: NAO_ESTA_NA_SALA), para a UI escolher o caminho. */
  codigoErro: string;
  /** Diferença entre o relógio do servidor e o do aparelho, em ms. */
  desvioRelogio: number;
  conectado: boolean;
  recarregar: () => Promise<void>;
}

export function useSala(salaId: string | null): SalaAoVivo {
  const [estado, setEstado] = useState<EstadoSala | null>(null);
  const [privados, setPrivados] = useState<EstadoPrivado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [codigoErro, setCodigoErro] = useState("");
  const [conectado, setConectado] = useState(true);

  const desvioRef = useRef(0);
  const [desvio, setDesvio] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buscandoRef = useRef(false);

  const recarregar = useCallback(async () => {
    if (!salaId || buscandoRef.current) return;
    buscandoRef.current = true;

    try {
      const dados = await chamar<EstadoSala>("estado_da_sala", { p_sala: salaId });

      // Cronômetros usam o relógio do servidor, não o do celular
      const novoDesvio = new Date(dados.servidor_agora).getTime() - Date.now();
      desvioRef.current = novoDesvio;
      setDesvio(novoDesvio);
      setEstado(dados);

      const { data, error } = await supabase
        .from("estados_privados")
        .select("*")
        .eq("sala_id", salaId);

      if (error) throw error;
      setPrivados((data ?? []) as EstadoPrivado[]);
      setErro(null);
      setCodigoErro("");
    } catch (e) {
      setErro(traduzirErro(e));
      setCodigoErro(codigoDoErro(e));
    } finally {
      buscandoRef.current = false;
      setCarregando(false);
    }
  }, [salaId]);

  /** Junta uma rajada de eventos numa releitura só. */
  const agendarLeitura = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void recarregar();
    }, 120);
  }, [recarregar]);

  // Assinatura do Realtime
  useEffect(() => {
    if (!salaId) return;

    void recarregar();

    const canal = supabase.channel(`sala:${salaId}`, {
      config: { broadcast: { self: false } }
    });

    for (const { nome, coluna } of TABELAS) {
      canal.on(
        "postgres_changes",
        { event: "*", schema: "public", table: nome, filter: `${coluna}=eq.${salaId}` },
        agendarLeitura
      );
    }

    canal.subscribe((status) => {
      const ok = status === "SUBSCRIBED";
      setConectado(ok);
      // Voltou do escuro: pode ter perdido evento, então relê tudo
      if (ok) void recarregar();
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(canal);
    };
  }, [salaId, agendarLeitura, recarregar]);

  // Batimento de presença + varredura de quem sumiu
  useEffect(() => {
    if (!salaId) return;

    const bater = async () => {
      try {
        await chamar("ping_presenca", { p_sala: salaId });
      } catch {
        /* sem rede: o próximo batimento resolve */
      }
    };

    const varrer = async () => {
      try {
        await chamar("varrer_ausentes", { p_sala: salaId });
      } catch {
        /* idem */
      }
    };

    void bater();
    const t1 = setInterval(bater, 12_000);
    const t2 = setInterval(varrer, 25_000);

    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [salaId]);

  // Voltar para a aba (ou para a rede) força uma releitura
  useEffect(() => {
    if (!salaId) return;

    const aoVoltar = () => {
      if (document.visibilityState === "visible") void recarregar();
    };

    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", aoVoltar);
    window.addEventListener("focus", aoVoltar);

    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [salaId, recarregar]);

  return {
    estado,
    privados,
    carregando,
    erro,
    codigoErro,
    desvioRelogio: desvio,
    conectado,
    recarregar
  };
}
