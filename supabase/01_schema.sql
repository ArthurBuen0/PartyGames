-- =============================================================================
-- Party Games — schema
-- =============================================================================
-- Rode este arquivo primeiro, no SQL Editor do Supabase.
-- Ordem: 01_schema → 02_policies → 03_funcoes → 04_seed → 05_realtime
-- =============================================================================

-- ------------------------------------------------------------------- Tipos

do $$ begin
  create type jogo_id as enum (
    'c-s-composto',
    'palavra-parecida',
    'quem-sou-eu',
    'mimica',
    'cara-a-cara',
    'duas-verdades',
    'verdade-ou-desafio'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_sala as enum ('lobby', 'jogando', 'encerrada');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Fases pelas quais uma rodada passa. Nem todo jogo usa todas.
  create type fase_rodada as enum (
    'preparando',   -- distribuindo cartas/segredos
    'escrevendo',   -- entrada privada (duas verdades)
    'em_andamento', -- turno rolando
    'votacao',      -- todo mundo votando
    'resultado',    -- resultado na tela
    'encerrada'
  );
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------ Salas

create table if not exists salas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null default 'Sala do Party Games',
  status status_sala not null default 'lobby',
  anfitriao_id uuid,                      -- FK adicionada depois (referência circular)
  jogo_atual jogo_id,
  partida_atual uuid,
  modo_adulto boolean not null default false,
  adulto_confirmado_em timestamptz,
  adulto_confirmado_por uuid,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  encerrada_em timestamptz,
  constraint codigo_formato check (codigo ~ '^[A-Z0-9]{4,8}$')
);

create index if not exists idx_salas_codigo on salas (codigo);

-- ---------------------------------------------------------- Participantes

create table if not exists participantes (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas (id) on delete cascade,
  usuario_id uuid not null,               -- auth.uid() da sessão anônima
  apelido text not null,
  cor text not null default 'roxo',
  e_anfitriao boolean not null default false,
  conectado boolean not null default true,
  visto_em timestamptz not null default now(),
  pontos integer not null default 0,
  eliminado boolean not null default false,
  ordem integer not null default 0,       -- ordem na roda
  entrou_em timestamptz not null default now(),
  saiu_em timestamptz,
  constraint apelido_tamanho check (char_length(trim(apelido)) between 1 and 20)
);

-- Uma pessoa (sessão) só tem um assento por sala
create unique index if not exists idx_participante_por_usuario
  on participantes (sala_id, usuario_id);

-- Apelido único dentro da sala, ignorando maiúsculas — só entre quem ainda está lá
create unique index if not exists idx_participante_apelido
  on participantes (sala_id, lower(trim(apelido)))
  where saiu_em is null;

create index if not exists idx_participantes_sala on participantes (sala_id);

alter table salas
  drop constraint if exists salas_anfitriao_fk;
alter table salas
  add constraint salas_anfitriao_fk
  foreign key (anfitriao_id) references participantes (id) on delete set null;

-- --------------------------------------------------------------- Partidas

create table if not exists partidas (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas (id) on delete cascade,
  jogo jogo_id not null,
  status text not null default 'ativa' check (status in ('ativa', 'encerrada')),
  config jsonb not null default '{}'::jsonb,   -- ex.: {"limitePerguntas": 10}
  criada_em timestamptz not null default now(),
  encerrada_em timestamptz
);

create index if not exists idx_partidas_sala on partidas (sala_id);

alter table salas
  drop constraint if exists salas_partida_fk;
alter table salas
  add constraint salas_partida_fk
  foreign key (partida_atual) references partidas (id) on delete set null;

-- --------------------------------------------------------------- Rodadas

create table if not exists rodadas (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references partidas (id) on delete cascade,
  sala_id uuid not null references salas (id) on delete cascade,
  numero integer not null default 1,
  fase fase_rodada not null default 'preparando',
  vez_de uuid references participantes (id) on delete set null,
  -- Estado COMPARTILHADO: todo mundo da sala pode ler.
  -- Ex.: {"categoria":"Frutas","regra":"C","historico":[...],"acertos":3}
  estado jsonb not null default '{}'::jsonb,
  -- Cronômetro do turno: sempre com horário do servidor, nunca do relógio local
  turno_inicio timestamptz,
  turno_fim timestamptz,
  resultado jsonb,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

create index if not exists idx_rodadas_partida on rodadas (partida_id);
create index if not exists idx_rodadas_sala on rodadas (sala_id);

-- ------------------------------------------------------- Estados privados
--
-- O coração da regra de visibilidade. Duas situações:
--
--   visivel_para_dono = true   → só o DONO lê (palavra da mímica, carta secreta,
--                                personagem do Cara a Cara, voto individual)
--   visivel_para_dono = false  → todo mundo lê MENOS o dono (Quem Sou Eu?:
--                                a identidade aparece para os outros, não para você)
--
-- A política de RLS em 02_policies aplica exatamente isso — o segredo não sai
-- do banco para o cliente errado, nem por consulta nem por Realtime.

create table if not exists estados_privados (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas (id) on delete cascade,
  rodada_id uuid references rodadas (id) on delete cascade,
  partida_id uuid references partidas (id) on delete cascade,
  dono_id uuid not null references participantes (id) on delete cascade,
  tipo text not null,                    -- 'identidade' | 'palavra' | 'personagem' | 'eliminados' | 'frases'
  conteudo jsonb not null default '{}'::jsonb,
  visivel_para_dono boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists idx_privados_sala on estados_privados (sala_id);
create index if not exists idx_privados_rodada on estados_privados (rodada_id);
create unique index if not exists idx_privados_unico
  on estados_privados (coalesce(rodada_id, partida_id), dono_id, tipo);

-- ----------------------------------------------------------------- Envios
-- Respostas públicas ou semipúblicas: palavras da corrente, frases, palpites.

create table if not exists envios (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas (id) on delete cascade,
  rodada_id uuid not null references rodadas (id) on delete cascade,
  autor_id uuid not null references participantes (id) on delete cascade,
  tipo text not null,                    -- 'palavra' | 'palpite' | 'pergunta' | 'resposta'
  conteudo jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_envios_rodada on envios (rodada_id, criado_em);

-- ------------------------------------------------------------------ Votos
-- O voto em si é privado até a revelação; a CONTAGEM é pública.

create table if not exists votos (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas (id) on delete cascade,
  rodada_id uuid not null references rodadas (id) on delete cascade,
  votante_id uuid not null references participantes (id) on delete cascade,
  alvo text not null,                    -- índice da frase, id de participante etc.
  revelado boolean not null default false,
  criado_em timestamptz not null default now()
);

create unique index if not exists idx_voto_unico on votos (rodada_id, votante_id);

-- ------------------------------------------------------------ Pontuações

create table if not exists pontuacoes (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas (id) on delete cascade,
  partida_id uuid references partidas (id) on delete cascade,
  rodada_id uuid references rodadas (id) on delete set null,
  participante_id uuid not null references participantes (id) on delete cascade,
  delta integer not null,
  motivo text not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_pontuacoes_sala on pontuacoes (sala_id, criado_em);

-- ----------------------------------------------------------------- Duelos
-- Mesas independentes do Cara a Cara (uma por dupla).

create table if not exists duelos (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas (id) on delete cascade,
  partida_id uuid not null references partidas (id) on delete cascade,
  mesa integer not null default 1,
  jogador_a uuid not null references participantes (id) on delete cascade,
  jogador_b uuid references participantes (id) on delete cascade,
  vez_de uuid references participantes (id) on delete set null,
  fase text not null default 'perguntando'
    check (fase in ('perguntando', 'respondendo', 'encerrado')),
  pergunta_atual text,
  historico jsonb not null default '[]'::jsonb,
  vencedor_id uuid references participantes (id) on delete set null,
  motivo_fim text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_duelos_partida on duelos (partida_id);

-- ------------------------------------------------------- Baralho de cartas
-- Conteúdo dos jogos. Fica no banco para o sorteio acontecer no servidor:
-- o cliente nunca escolhe a carta secreta, só recebe o que tem direito de ver.

create table if not exists cartas (
  id uuid primary key default gen_random_uuid(),
  jogo jogo_id not null,
  tipo text not null,                    -- 'categoria' | 'palavra' | 'identidade' | 'mimica' | 'verdade' | 'desafio' | 'tema' | 'personagem'
  conteudo jsonb not null,
  adulto boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists idx_cartas_busca on cartas (jogo, tipo, adulto) where ativo;

-- ----------------------------------------------------------------- Grants
-- O RLS (02_policies) é quem realmente decide o acesso; sem grant, nem começa.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  salas, participantes, partidas, rodadas, estados_privados,
  envios, votos, pontuacoes, duelos
  to authenticated;
grant select on cartas to authenticated;
