import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { chamar } from "../lib/supabase";
import { traduzirErro } from "../lib/erros";
import { guardarApelido, guardarSessao, lerSessao, ultimoApelido } from "../lib/sessaoLocal";
import { Botao, Cartao, useAviso } from "../componentes/Base";
import { JOGOS } from "../lib/jogos";

/**
 * Tela inicial: criar uma sala ou entrar em uma que já existe.
 * Nada de cadastro — apelido e pronto.
 */
export function Inicio() {
  const navegar = useNavigate();
  const { avisar } = useAviso();

  const [apelido, setApelido] = useState(ultimoApelido());
  const [codigo, setCodigo] = useState("");
  const [modo, setModo] = useState<"escolher" | "entrar">("escolher");
  const [ocupado, setOcupado] = useState<"criar" | "entrar" | null>(null);

  const anterior = lerSessao();

  async function criarSala(e: FormEvent) {
    e.preventDefault();
    if (!apelido.trim()) {
      avisar("Escolha um apelido primeiro 🙂", "erro");
      return;
    }

    setOcupado("criar");
    try {
      const r = await chamar<{ sala_id: string; codigo: string }>("criar_sala", {
        p_apelido: apelido.trim()
      });

      guardarApelido(apelido.trim());
      guardarSessao({ salaId: r.sala_id, codigo: r.codigo, apelido: apelido.trim() });
      navegar(`/sala/${r.codigo}`);
    } catch (erro) {
      avisar(traduzirErro(erro), "erro");
    } finally {
      setOcupado(null);
    }
  }

  async function entrarSala(e: FormEvent) {
    e.preventDefault();
    const codigoLimpo = codigo.trim().toUpperCase();

    if (!apelido.trim()) {
      avisar("Escolha um apelido primeiro 🙂", "erro");
      return;
    }
    if (codigoLimpo.length < 4) {
      avisar("O código da sala tem 4 letras", "erro");
      return;
    }

    setOcupado("entrar");
    try {
      const r = await chamar<{ sala_id: string; codigo: string }>("entrar_sala", {
        p_codigo: codigoLimpo,
        p_apelido: apelido.trim()
      });

      guardarApelido(apelido.trim());
      guardarSessao({ salaId: r.sala_id, codigo: r.codigo, apelido: apelido.trim() });
      navegar(`/sala/${r.codigo}`);
    } catch (erro) {
      avisar(traduzirErro(erro), "erro");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 area-segura-baixo">
      {/* Marca */}
      <div className="text-center">
        <span
          className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-linear-to-br from-roxo-500 via-roxo-700 to-rosa-500 text-3xl shadow-[0_10px_24px_rgba(109,40,217,0.3)]"
          aria-hidden="true"
        >
          🎲
        </span>
        <h1 className="mt-4 fonte-titulo text-4xl font-extrabold text-roxo-900 sm:text-5xl">
          Party Games
        </h1>
        <p className="mx-auto mt-3 max-w-md text-lg text-texto-suave">
          Jogos rápidos para jogar cara a cara com a galera.
        </p>
      </div>

      {/* Voltar para a sala anterior */}
      {anterior && (
        <Cartao className="border-roxo-200 bg-roxo-50">
          <p className="text-sm text-texto-suave">
            Você estava na sala <strong className="text-roxo-700">{anterior.codigo}</strong> como{" "}
            <strong className="text-roxo-700">{anterior.apelido}</strong>.
          </p>
          <Botao
            largo
            className="mt-3"
            onClick={() => navegar(`/sala/${anterior.codigo}`)}
          >
            Voltar para a sala
          </Botao>
        </Cartao>
      )}

      <Cartao>
        <form onSubmit={modo === "entrar" ? entrarSala : criarSala} className="flex flex-col gap-4">
          <div>
            <label htmlFor="apelido" className="mb-1.5 block font-bold">
              Seu apelido
            </label>
            <input
              id="apelido"
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              maxLength={20}
              autoComplete="nickname"
              placeholder="Como a galera te chama?"
              className="min-h-[52px] w-full rounded-[var(--radius-suave)] border-2 border-borda-forte px-4 text-base transition-colors focus:border-roxo-500 focus:outline-none"
            />
            <p className="mt-1 text-sm text-texto-fraco">
              Sem cadastro, sem senha. Só o apelido.
            </p>
          </div>

          {modo === "entrar" && (
            <div className="surgir">
              <label htmlFor="codigo" className="mb-1.5 block font-bold">
                Código da sala
              </label>
              <input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                maxLength={8}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="ABCD"
                className="min-h-[60px] w-full rounded-[var(--radius-suave)] border-2 border-borda-forte px-4 text-center fonte-titulo text-3xl font-extrabold tracking-[0.3em] uppercase transition-colors focus:border-roxo-500 focus:outline-none"
              />
              <p className="mt-1 text-sm text-texto-fraco">
                As 4 letras que o anfitrião mandou no grupo.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {modo === "escolher" ? (
              <>
                <Botao type="submit" grande largo carregando={ocupado === "criar"}>
                  <span aria-hidden="true">✨</span> Criar sala
                </Botao>
                <Botao
                  type="button"
                  variante="secundario"
                  grande
                  largo
                  onClick={() => setModo("entrar")}
                >
                  <span aria-hidden="true">🔑</span> Entrar em uma sala
                </Botao>
              </>
            ) : (
              <>
                <Botao type="submit" grande largo carregando={ocupado === "entrar"}>
                  Entrar na sala
                </Botao>
                <Botao
                  type="button"
                  variante="fantasma"
                  largo
                  onClick={() => setModo("escolher")}
                >
                  ← Voltar
                </Botao>
              </>
            )}
          </div>
        </form>
      </Cartao>

      {/* Como funciona */}
      <section aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="mb-3 fonte-titulo text-xl text-roxo-900">
          Como funciona
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            { emoji: "🏠", titulo: "Crie a sala", texto: "Você vira o anfitrião e recebe um código de 4 letras." },
            { emoji: "🔗", titulo: "Mande o link", texto: "A galera entra pelo celular só com o apelido." },
            { emoji: "🎮", titulo: "Joguem juntos", texto: "Cada um na sua tela, tudo sincronizado ao vivo." }
          ].map((passo, i) => (
            <li key={i} className="rounded-[var(--radius-card)] border border-borda bg-white p-4">
              <span className="text-3xl" aria-hidden="true">{passo.emoji}</span>
              <h3 className="mt-2 fonte-titulo text-lg">{passo.titulo}</h3>
              <p className="mt-1 text-sm text-texto-suave">{passo.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Vitrine dos jogos */}
      <section aria-labelledby="jogos-disponiveis">
        <h2 id="jogos-disponiveis" className="mb-3 fonte-titulo text-xl text-roxo-900">
          {JOGOS.length} brincadeiras esperando
        </h2>
        <ul className="flex flex-wrap gap-2">
          {JOGOS.map((jogo) => (
            <li
              key={jogo.id}
              className="flex items-center gap-2 rounded-full border border-borda bg-white px-3 py-2 text-sm font-bold"
            >
              <span aria-hidden="true">{jogo.emoji}</span>
              {jogo.nome}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto pt-6 text-center text-sm text-texto-fraco">
        <p>Feito para jogar junto — presencialmente, cada um no seu celular.</p>
      </footer>
    </main>
  );
}
