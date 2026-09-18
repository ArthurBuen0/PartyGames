-- =============================================================================
-- Party Games — RLS (quem pode ler o quê)
-- =============================================================================
-- Princípio do projeto: o cliente NUNCA escreve direto nas tabelas.
-- Toda mudança passa por uma função RPC (03_funcoes.sql), que valida quem está
-- chamando. Aqui embaixo só liberamos LEITURA — e é a leitura que carrega a
-- regra de visibilidade dos segredos.
-- =============================================================================

-- --------------------------------------------------------------- Ajudantes
-- SECURITY DEFINER: rodam como dono da tabela e por isso não passam pelo RLS.
-- Sem isso, uma política que consulta `participantes` entraria em recursão.

create or replace function app_participante_id(p_sala uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from participantes p
  where p.sala_id = p_sala
    and p.usuario_id = auth.uid()
    and p.saiu_em is null
  limit 1;
$$;

comment on function app_participante_id is
  'Meu assento nesta sala (ou null se não estou nela).';

create or replace function app_esta_na_sala(p_sala uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from participantes p
    where p.sala_id = p_sala
      and p.usuario_id = auth.uid()
      and p.saiu_em is null
  );
$$;

create or replace function app_e_anfitriao(p_sala uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from participantes p
    where p.sala_id = p_sala
      and p.usuario_id = auth.uid()
      and p.saiu_em is null
      and p.e_anfitriao
  );
$$;

grant execute on function app_participante_id(uuid) to authenticated;
grant execute on function app_esta_na_sala(uuid) to authenticated;
grant execute on function app_e_anfitriao(uuid) to authenticated;

-- ------------------------------------------------------------ Ligando RLS

alter table salas             enable row level security;
alter table participantes     enable row level security;
alter table partidas          enable row level security;
alter table rodadas           enable row level security;
alter table estados_privados  enable row level security;
alter table envios            enable row level security;
alter table votos             enable row level security;
alter table avaliacoes        enable row level security;
alter table etapas_desenho    enable row level security;
alter table pontuacoes        enable row level security;
alter table duelos            enable row level security;
alter table cartas            enable row level security;

-- ----------------------------------------------------- Estado compartilhado
-- Tudo que a sala inteira pode ver. Entrar na sala é o único requisito.

drop policy if exists "sala visível para quem está nela" on salas;
create policy "sala visível para quem está nela"
  on salas for select
  to authenticated
  using (app_esta_na_sala(id));

drop policy if exists "participantes visíveis na sala" on participantes;
create policy "participantes visíveis na sala"
  on participantes for select
  to authenticated
  using (app_esta_na_sala(sala_id));

drop policy if exists "partidas visíveis na sala" on partidas;
create policy "partidas visíveis na sala"
  on partidas for select
  to authenticated
  using (app_esta_na_sala(sala_id));

drop policy if exists "rodadas visíveis na sala" on rodadas;
create policy "rodadas visíveis na sala"
  on rodadas for select
  to authenticated
  using (app_esta_na_sala(sala_id));

drop policy if exists "envios visíveis na sala" on envios;
create policy "envios visíveis na sala"
  on envios for select
  to authenticated
  using (app_esta_na_sala(sala_id));

drop policy if exists "pontuações visíveis na sala" on pontuacoes;
create policy "pontuações visíveis na sala"
  on pontuacoes for select
  to authenticated
  using (app_esta_na_sala(sala_id));

drop policy if exists "duelos visíveis na sala" on duelos;
create policy "duelos visíveis na sala"
  on duelos for select
  to authenticated
  using (app_esta_na_sala(sala_id));

-- ------------------------------------------------------------------- Votos
-- Voto é secreto até a revelação. Você sempre enxerga o seu; os dos outros,
-- só depois que a rodada revela. A CONTAGEM parcial não vem daqui: vem do
-- estado compartilhado da rodada, que guarda só o número de votos.

drop policy if exists "voto próprio ou já revelado" on votos;
create policy "voto próprio ou já revelado"
  on votos for select
  to authenticated
  using (
    app_esta_na_sala(sala_id)
    and (revelado or votante_id = app_participante_id(sala_id))
  );

-- -------------------------------------------------------------- Avaliações
-- Mesmo princípio dos votos: cada palavra do C, S, Composto só revela quem
-- avaliou o quê depois que a rodada inteira é revelada.

drop policy if exists "avaliação própria ou já revelada" on avaliacoes;
create policy "avaliação própria ou já revelada"
  on avaliacoes for select
  to authenticated
  using (
    app_esta_na_sala(sala_id)
    and (revelado or avaliador_id = app_participante_id(sala_id))
  );

-- -------------------------------------------------------------- Etapas
-- Mesmo princípio: cada etapa do Desenho Telefone só é lida por quem a fez,
-- até a rodada inteira ser revelada no final — ninguém adianta a cadeia.

drop policy if exists "etapa própria ou já revelada" on etapas_desenho;
create policy "etapa própria ou já revelada"
  on etapas_desenho for select
  to authenticated
  using (
    app_esta_na_sala(sala_id)
    and (revelado or autor_id = app_participante_id(sala_id))
  );

-- ------------------------------------------------------- Estados privados
--
-- A regra que o jogo inteiro depende:
--
--   visivel_para_dono = true  → SÓ o dono lê.
--       palavra da mímica, personagem do Cara a Cara, frases ainda não enviadas
--
--   visivel_para_dono = false → todos leem MENOS o dono.
--       "Quem Sou Eu?": sua identidade é justamente o que você não pode ver
--
-- Como o Realtime do Supabase respeita RLS, o segredo também não vaza pelo
-- canal de tempo real — o cliente errado simplesmente não recebe a linha.

drop policy if exists "segredo vai só para quem tem direito" on estados_privados;
create policy "segredo vai só para quem tem direito"
  on estados_privados for select
  to authenticated
  using (
    app_esta_na_sala(sala_id)
    and (
      (visivel_para_dono and dono_id = app_participante_id(sala_id))
      or
      (not visivel_para_dono and dono_id <> app_participante_id(sala_id))
    )
  );

-- ------------------------------------------------------------------ Cartas
-- O baralho é conteúdo, não segredo — mas o material +18 nunca é exposto
-- por leitura direta. Ele só circula através das RPCs, e apenas em salas que
-- confirmaram o modo adulto.

drop policy if exists "baralho leve é público para quem entrou" on cartas;
create policy "baralho leve é público para quem entrou"
  on cartas for select
  to authenticated
  using (ativo and not adulto);
