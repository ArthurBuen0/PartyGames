import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { chamar } from "../lib/supabase";
import { traduzirErro } from "../lib/erros";
import {
  esquecerSessao, guardarApelido, guardarSessao, lerSessao, ultimoApelido
} from "../lib/sessaoLocal";
import { useSala } from "../hooks/useSala";
import { Botao, Carregando, Cartao, useAviso } from "../componentes/Base";
import { Lobby } from "./Lobby";
import { Mesa } from "./Mesa";

/**
 * Porta de entrada da sala.
 *
 * Três estados possíveis, nesta ordem:
 *   1. ainda não sou participante  → formulário de apelido
 *   2. sou participante, sala em lobby → <Lobby>
 *   3. partida rolando → <Mesa>
 *
 * A reconexão é o caminho normal, não a exceção: se o navegador lembra a sala,
 * vai direto para o estado 2 ou 3 sem perguntar nada.
 */
export function Sala() {
  const { codigo = "" } = useParams();
  const navegar = useNavigate();
  const { avisar } = useAviso();

  const guardado = lerSessao(codigo);
  const [salaId, setSalaId] = useState<string | null>(guardado?.salaId ?? null);

  const sala = useSala(salaId);

  // O assento não existe mais (removido, sala encerrada, outro navegador)
  useEffect(() => {
    if (sala.codigoErro === "NAO_ESTA_NA_SALA") {
      setSalaId(null);
      esquecerSessao();
    }
  }, [sala.codigoErro]);

  const sair = useCallback(async () => {
    if (!salaId) return;
    try {
      await chamar("sair_sala", { p_sala: salaId });
    } catch {
      /* já pode ter saído; o que importa é liberar a tela */
    }
    esquecerSessao();
    setSalaId(null);
    navegar("/");
  }, [salaId, navegar]);

  if (!salaId) {
    return <FormularioEntrada codigo={codigo} aoEntrar={setSalaId} avisar={avisar} />;
  }

  if (sala.carregando && !sala.estado) {
    return <Carregando texto="Entrando na sala…" />;
  }

  if (!sala.estado) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-lg place-items-center p-4">
        <Cartao className="text-center">
          <p className="text-5xl" aria-hidden="true">😕</p>
          <h1 className="mt-3 fonte-titulo text-2xl text-roxo-900">Não deu para abrir a sala</h1>
          <p className="mt-2 text-texto-suave">{sala.erro}</p>
          <div className="mt-5 flex flex-col gap-2">
            <Botao largo onClick={() => void sala.recarregar()}>Tentar de novo</Botao>
            <Botao variante="secundario" largo onClick={() => navegar("/")}>
              Voltar ao início
            </Botao>
          </div>
        </Cartao>
      </main>
    );
  }

  if (sala.estado.sala.status === "encerrada") {
    return (
      <main className="mx-auto grid min-h-dvh max-w-lg place-items-center p-4">
        <Cartao className="text-center">
          <p className="text-5xl" aria-hidden="true">👋</p>
          <h1 className="mt-3 fonte-titulo text-2xl text-roxo-900">Esta sala foi encerrada</h1>
          <p className="mt-2 text-texto-suave">Obrigado por jogar! Que tal abrir outra?</p>
          <Botao
            largo
            grande
            className="mt-5"
            onClick={() => {
              esquecerSessao();
              navegar("/");
            }}
          >
            Criar uma sala nova
          </Botao>
        </Cartao>
      </main>
    );
  }

  if (sala.estado.sala.status === "jogando" && sala.estado.partida) {
    return <Mesa sala={sala} aoSair={sair} />;
  }

  return <Lobby sala={sala} aoSair={sair} />;
}

/* ================================================ Formulário de entrada */

function FormularioEntrada({
  codigo,
  aoEntrar,
  avisar
}: {
  codigo: string;
  aoEntrar: (id: string) => void;
  avisar: (texto: string, tipo?: "ok" | "erro" | "info") => void;
}) {
  const navegar = useNavigate();
  const [apelido, setApelido] = useState(ultimoApelido());
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (!apelido.trim()) {
      setErro("Escolha um apelido para entrar.");
      return;
    }

    setOcupado(true);
    setErro(null);
    try {
      const r = await chamar<{ sala_id: string; codigo: string; reconectado: boolean }>(
        "entrar_sala",
        { p_codigo: codigo, p_apelido: apelido.trim() }
      );

      guardarApelido(apelido.trim());
      guardarSessao({ salaId: r.sala_id, codigo: r.codigo, apelido: apelido.trim() });
      aoEntrar(r.sala_id);
      avisar(r.reconectado ? "Bem-vindo de volta! 👋" : "Você entrou na sala 🎉", "ok");
    } catch (e2) {
      setErro(traduzirErro(e2));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-lg place-items-center p-4">
      <Cartao className="w-full">
        <div className="text-center">
          <span className="text-4xl" aria-hidden="true">🚪</span>
          <h1 className="mt-2 fonte-titulo text-2xl text-roxo-900">Entrar na sala</h1>
          <p className="mt-1 text-texto-suave">
            Código <strong className="tracking-[0.2em] text-roxo-700">{codigo}</strong>
          </p>
        </div>

        <form onSubmit={entrar} className="mt-5 flex flex-col gap-4">
          <div>
            <label htmlFor="apelido-sala" className="mb-1.5 block font-bold">
              Seu apelido
            </label>
            <input
              id="apelido-sala"
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              maxLength={20}
              autoFocus
              autoComplete="nickname"
              placeholder="Como a galera te chama?"
              aria-describedby={erro ? "erro-entrada" : undefined}
              className="min-h-[52px] w-full rounded-[var(--radius-suave)] border-2 border-borda-forte px-4 transition-colors focus:border-roxo-500 focus:outline-none"
            />
          </div>

          {erro && (
            <p
              id="erro-entrada"
              role="alert"
              className="rounded-[var(--radius-suave)] bg-coral-100 p-3 text-sm font-bold text-coral-600"
            >
              {erro}
            </p>
          )}

          <Botao type="submit" grande largo carregando={ocupado}>
            Entrar
          </Botao>
          <Botao type="button" variante="fantasma" largo onClick={() => navegar("/")}>
            ← Voltar ao início
          </Botao>
        </form>
      </Cartao>
    </main>
  );
}
