import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { garantirSessao, supabaseConfigurado } from "./lib/supabase";
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

/** Sem .env não dá para nem começar — melhor explicar do que mostrar tela branca. */
function FaltaConfigurar() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-2xl place-items-center p-4">
      <Cartao>
        <h1 className="fonte-titulo text-2xl text-roxo-900">Falta conectar o Supabase 🔌</h1>

        <p className="mt-3 text-texto-suave">
          Crie um arquivo <code className="rounded bg-superficie-2 px-1.5 py-0.5">.env</code> na
          raiz do projeto com as duas chaves do seu projeto Supabase:
        </p>

        <pre className="mt-3 overflow-x-auto rounded-[var(--radius-suave)] bg-roxo-900 p-4 text-sm text-white">
{`VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
        </pre>

        <p className="mt-3 text-texto-suave">
          Depois aplique os arquivos de <code className="rounded bg-superficie-2 px-1.5 py-0.5">supabase/</code>{" "}
          no SQL Editor, na ordem 01 → 05, e reinicie o <code className="rounded bg-superficie-2 px-1.5 py-0.5">npm run dev</code>.
          O passo a passo completo está no README.
        </p>
      </Cartao>
    </main>
  );
}
