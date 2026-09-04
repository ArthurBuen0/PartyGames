import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { garantirSessao, problemasDeConfig, supabaseConfigurado } from "./lib/supabase";
import { traduzirErro } from "./lib/erros";
import { Carregando, Cartao, ProvedorAvisos } from "./componentes/Base";
import { Inicio } from "./paginas/Inicio";
import { Sala } from "./paginas/Sala";

/**
 * Raiz do app.
 *
 * Antes de qualquer tela, garante a sessão anônima: é o `auth.uid()` dela que
 * o RLS usa para decidir o que esta pessoa pode ler. Sem sessão, nem a lista de
 * participantes carregaria.
 */
export function App() {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigurado) {
      setPronto(true);
      return;
    }

    garantirSessao()
      .then(() => setPronto(true))
      .catch((e) => {
        setErro(traduzirErro(e));
        setPronto(true);
      });
  }, []);

  if (!supabaseConfigurado) return <FaltaConfigurar />;
  if (!pronto) return <Carregando texto="Preparando sua sessão…" />;

  return (
    <ProvedorAvisos>
      {erro && (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <p className="rounded-[var(--radius-suave)] bg-coral-100 p-3 text-center text-sm font-bold text-coral-600">
            {erro}
          </p>
        </div>
      )}

      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/sala/:codigo" element={<Sala />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ProvedorAvisos>
  );
}

/**
 * Configuração incompleta ou errada.
 *
 * Em vez de um texto genérico, a tela diz qual variável está com problema e
 * qual é o problema — inclusive quando o valor foi colado no campo errado.
 * Quem estiver publicando consegue arrumar sem abrir o DevTools.
 */
function FaltaConfigurar() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-2xl place-items-center p-4">
      <Cartao>
        <h1 className="fonte-titulo text-2xl text-roxo-900">Falta conectar o Supabase 🔌</h1>

        <ul className="mt-4 flex flex-col gap-3">
          {problemasDeConfig.map((p) => (
            <li
              key={p.variavel}
              className="rounded-[var(--radius-suave)] border border-coral-100 bg-coral-100/40 p-4"
            >
              <p className="font-mono text-sm font-bold text-coral-600">{p.variavel}</p>
              <p className="mt-1 font-bold text-texto">{p.problema}</p>
              <p className="mt-1 text-sm text-texto-suave">{p.comoArrumar}</p>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-texto-suave">
          Rodando na sua máquina? Crie um{" "}
          <code className="rounded bg-superficie-2 px-1.5 py-0.5">.env</code> na raiz do projeto:
        </p>

        <pre className="mt-3 overflow-x-auto rounded-[var(--radius-suave)] bg-roxo-900 p-4 text-sm text-white">
{`VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxx`}
        </pre>

        <p className="mt-3 text-texto-suave">
          Publicado na Vercel? Ajuste em <strong>Settings → Environment Variables</strong> e faça
          um <strong>Redeploy</strong> — os valores entram no site durante o build, então salvar
          sozinho não muda nada. O passo a passo está no DEPLOY.md.
        </p>
      </Cartao>
    </main>
  );
}
