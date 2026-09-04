-- =============================================================================
-- Party Games — funções RPC
-- =============================================================================
-- Todas as mudanças de estado passam por aqui. As funções são SECURITY DEFINER
-- (rodam como dona das tabelas, ignorando RLS) e por isso cada uma valida na
-- unha quem está chamando: se você não está na sala, ou não é o anfitrião, ou
-- não é a sua vez, a função levanta exceção.
--
-- Vantagens dessa escolha:
--   • o sorteio da carta secreta acontece no servidor — o cliente não escolhe
--     nem enxerga o que não deve;
--   • o cronômetro usa now() do Postgres, então ninguém ganha tempo mexendo no
--     relógio do celular;
--   • o cliente pode ser burro: só chama ação e redesenha o que voltar.
--
-- Convenção de erro: a mensagem é um código em MAIÚSCULAS que o front traduz
-- (ver src/lib/erros.ts).
-- =============================================================================

-- ============================================================================
-- 1. AJUDANTES INTERNOS
-- ============================================================================

create or replace function _erro(p_codigo text)
returns void language plpgsql as $$
begin
  raise exception '%', p_codigo using errcode = 'P0001';
end;
$$;

/** Meu participante nesta sala, ou exceção se não estou nela. */
create or replace function _exige_participante(p_sala uuid)
returns participantes
language plpgsql stable security definer set search_path = public as $$
declare v participantes;
begin
  select * into v from participantes
  where sala_id = p_sala and usuario_id = auth.uid() and saiu_em is null;
  if not found then perform _erro('NAO_ESTA_NA_SALA'); end if;
  return v;
end;
$$;

/** Igual ao anterior, mas exige o crachá de anfitrião. */
create or replace function _exige_anfitriao(p_sala uuid)
returns participantes
language plpgsql stable security definer set search_path = public as $$
declare v participantes;
begin
  v := _exige_participante(p_sala);
  if not v.e_anfitriao then perform _erro('SO_O_ANFITRIAO'); end if;
  return v;
end;
$$;

/** Marca a sala como mexida — ajuda o Realtime a acordar todo mundo. */
create or replace function _toca_sala(p_sala uuid)
returns void language sql security definer set search_path = public as $$
  update salas set atualizada_em = now() where id = p_sala;
$$;

/** Quantidade de gente ainda em jogo (não eliminada, não saiu). */
create or replace function _ativos(p_sala uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from participantes
  where sala_id = p_sala and saiu_em is null and not eliminado;
$$;

/**
 * Próximo jogador na roda: segue a ordem de entrada, pula quem saiu ou foi
 * eliminado e dá a volta no fim da lista. Quem está apenas desconectado
 * continua na roda — cabe ao anfitrião pular a vez dele.
 */
create or replace function _proximo_jogador(p_sala uuid, p_atual uuid)
returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_ordem integer;
  v_proximo uuid;
begin
  select ordem into v_ordem from participantes where id = p_atual;
  if v_ordem is null then v_ordem := -1; end if;

  select id into v_proximo from participantes
  where sala_id = p_sala and saiu_em is null and not eliminado and ordem > v_ordem
  order by ordem, id limit 1;

  if v_proximo is null then
    select id into v_proximo from participantes
    where sala_id = p_sala and saiu_em is null and not eliminado
    order by ordem, id limit 1;
  end if;

  return v_proximo;
end;
$$;

/** Sorteia uma carta do baralho, podendo excluir as que já saíram. */
create or replace function _sortear_carta(
  p_jogo jogo_id,
  p_tipo text,
  p_adulto boolean default false,
  p_excluir jsonb default '[]'::jsonb
)
returns cartas
language plpgsql volatile security definer set search_path = public as $$
declare v cartas;
begin
  select * into v from cartas c
  where c.jogo = p_jogo and c.tipo = p_tipo and c.ativo and c.adulto = p_adulto
    and c.id::text not in (select jsonb_array_elements_text(p_excluir))
  order by random() limit 1;

  -- Baralho esgotado: recomeça ignorando o histórico
  if not found then
    select * into v from cartas c
    where c.jogo = p_jogo and c.tipo = p_tipo and c.ativo and c.adulto = p_adulto
    order by random() limit 1;
  end if;

  if not found then perform _erro('BARALHO_VAZIO'); end if;
  return v;
end;
$$;

/** Lança pontos e mantém o placar do participante somado. */
create or replace function _pontuar(
  p_sala uuid, p_partida uuid, p_rodada uuid,
  p_participante uuid, p_delta integer, p_motivo text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into pontuacoes (sala_id, partida_id, rodada_id, participante_id, delta, motivo)
  values (p_sala, p_partida, p_rodada, p_participante, p_delta, p_motivo);

  update participantes set pontos = pontos + p_delta where id = p_participante;
end;
$$;

/** Rodada atual da sala (a mais recente da partida em andamento). */
create or replace function _rodada_atual(p_sala uuid)
returns rodadas
language plpgsql stable security definer set search_path = public as $$
declare v rodadas;
begin
  select r.* into v from rodadas r
  join salas s on s.partida_atual = r.partida_id
  where s.id = p_sala
  order by r.numero desc limit 1;
  return v;
end;
$$;

/** Duração do turno de cada jogo, em segundos. null = sem cronômetro. */
create or replace function _duracao_turno(p_jogo jogo_id, p_fase fase_rodada)
returns integer language sql immutable as $$
  select case
    when p_jogo = 'c-s-composto' then 5
    when p_jogo = 'palavra-parecida' then 5
    -- Mímica: os 60s só começam quando o mímico apertar "começar", nunca antes
    when p_jogo = 'mimica' and p_fase = 'em_andamento' then 60
    when p_jogo = 'duas-verdades' and p_fase = 'escrevendo' then 120
    when p_jogo = 'duas-verdades' and p_fase = 'votacao' then 60
    else null
  end;
$$;

-- ============================================================================
-- 2. SALA: criar, entrar, sair, moderar
-- ============================================================================

create or replace function _codigo_livre()
returns text language plpgsql security definer set search_path = public as $$
declare
  -- Sem I, O, 0 e 1: ninguém erra ao ditar o código no grupo
  v_alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text;
  v_tentativa integer := 0;
begin
  loop
    v_codigo := '';
    for i in 1..4 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;

    exit when not exists (
      select 1 from salas where codigo = v_codigo and status <> 'encerrada'
    );

    v_tentativa := v_tentativa + 1;
    if v_tentativa > 50 then perform _erro('SEM_CODIGO_DISPONIVEL'); end if;
  end loop;
  return v_codigo;
end;
$$;

create or replace function _cor_da_vez(p_indice integer)
returns text language sql immutable as $$
  select (array['roxo','rosa','amarelo','turquesa','coral','azul','verde','laranja'])
         [1 + (p_indice % 8)];
$$;

/** Cria a sala e senta o criador como anfitrião. */
create or replace function criar_sala(p_apelido text, p_nome text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sala salas;
  v_participante participantes;
  v_apelido text := trim(p_apelido);
begin
  if auth.uid() is null then perform _erro('SEM_SESSAO'); end if;
  if char_length(v_apelido) < 1 or char_length(v_apelido) > 20 then
    perform _erro('APELIDO_INVALIDO');
  end if;

  insert into salas (codigo, nome)
  values (_codigo_livre(), coalesce(nullif(trim(p_nome), ''), 'Sala de ' || v_apelido))
  returning * into v_sala;

  insert into participantes (sala_id, usuario_id, apelido, cor, e_anfitriao, ordem)
  values (v_sala.id, auth.uid(), v_apelido, _cor_da_vez(0), true, 0)
  returning * into v_participante;

  update salas set anfitriao_id = v_participante.id where id = v_sala.id;

  return jsonb_build_object(
    'sala_id', v_sala.id,
    'codigo', v_sala.codigo,
    'participante_id', v_participante.id
  );
end;
$$;

/**
 * Entra na sala pelo código. Se a mesma sessão já tinha um assento (recarregou
 * a página, caiu a internet, fechou o app sem querer), reaproveita o assento em
 * vez de criar outro — é o que faz a reconexão parecer natural.
 */
create or replace function entrar_sala(p_codigo text, p_apelido text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sala salas;
  v_participante participantes;
  v_apelido text := trim(p_apelido);
  v_total integer;
begin
  if auth.uid() is null then perform _erro('SEM_SESSAO'); end if;
  if char_length(v_apelido) < 1 or char_length(v_apelido) > 20 then
    perform _erro('APELIDO_INVALIDO');
  end if;

  select * into v_sala from salas
  where codigo = upper(trim(p_codigo)) and status <> 'encerrada'
  order by criada_em desc limit 1;

  if not found then
    -- Existe, mas já acabou? A mensagem muda para a pessoa entender.
    if exists (select 1 from salas where codigo = upper(trim(p_codigo))) then
      perform _erro('SALA_ENCERRADA');
    end if;
    perform _erro('SALA_NAO_ENCONTRADA');
  end if;

  -- Assento antigo desta mesma sessão: volta para ele
  select * into v_participante from participantes
  where sala_id = v_sala.id and usuario_id = auth.uid();

  if found then
    -- Alguém pode ter assumido o apelido enquanto esta pessoa estava fora
    if exists (
      select 1 from participantes
      where sala_id = v_sala.id and saiu_em is null and id <> v_participante.id
        and lower(trim(apelido)) = lower(v_apelido)
    ) then
      perform _erro('APELIDO_EM_USO');
    end if;

    update participantes
    set saiu_em = null, conectado = true, visto_em = now(), apelido = v_apelido
    where id = v_participante.id
    returning * into v_participante;

    perform _toca_sala(v_sala.id);
    return jsonb_build_object(
      'sala_id', v_sala.id, 'codigo', v_sala.codigo,
      'participante_id', v_participante.id, 'reconectado', true
    );
  end if;

  select count(*) into v_total from participantes
  where sala_id = v_sala.id and saiu_em is null;

  if v_total >= 12 then perform _erro('SALA_CHEIA'); end if;

  if exists (
    select 1 from participantes
    where sala_id = v_sala.id and saiu_em is null
      and lower(trim(apelido)) = lower(v_apelido)
  ) then
    perform _erro('APELIDO_EM_USO');
  end if;

  insert into participantes (sala_id, usuario_id, apelido, cor, ordem)
  values (v_sala.id, auth.uid(), v_apelido, _cor_da_vez(v_total), v_total)
  returning * into v_participante;

  perform _toca_sala(v_sala.id);

  return jsonb_build_object(
    'sala_id', v_sala.id, 'codigo', v_sala.codigo,
    'participante_id', v_participante.id, 'reconectado', false
  );
end;
$$;

/** Bate o ponto: mantém "conectado" e serve de heartbeat. */
create or replace function ping_presenca(p_sala uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v participantes;
begin
  v := _exige_participante(p_sala);
  update participantes set visto_em = now(), conectado = true where id = v.id;
end;
$$;

/**
 * Marca como desconectado quem sumiu há mais de 30 segundos. Qualquer cliente
 * da sala pode chamar — é uma varredura barata que mantém a lista honesta sem
 * depender de um processo de fundo.
 */
create or replace function varrer_ausentes(p_sala uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exige_participante(p_sala);
  update participantes
  set conectado = false
  where sala_id = p_sala and saiu_em is null and conectado
    and visto_em < now() - interval '30 seconds';
end;
$$;

/** Sai da sala. Se era o anfitrião, a faixa passa para o próximo da fila. */
create or replace function sair_sala(p_sala uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v participantes;
  v_novo uuid;
begin
  v := _exige_participante(p_sala);

  update participantes
  set saiu_em = now(), conectado = false, e_anfitriao = false
  where id = v.id;

  if v.e_anfitriao then
    select id into v_novo from participantes
    where sala_id = p_sala and saiu_em is null
    order by ordem, id limit 1;

    if v_novo is null then
      -- Saiu a última pessoa: a sala morre junto
      update salas set status = 'encerrada', encerrada_em = now(), anfitriao_id = null
      where id = p_sala;
    else
      update participantes set e_anfitriao = true where id = v_novo;
      update salas set anfitriao_id = v_novo where id = p_sala;
    end if;
  end if;

  perform _toca_sala(p_sala);
end;
$$;

/** Anfitrião tira alguém da sala. */
create or replace function remover_participante(p_participante uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_alvo participantes;
begin
  select * into v_alvo from participantes where id = p_participante;
  if not found then perform _erro('PARTICIPANTE_NAO_ENCONTRADO'); end if;

  perform _exige_anfitriao(v_alvo.sala_id);
  if v_alvo.e_anfitriao then perform _erro('NAO_PODE_REMOVER_ANFITRIAO'); end if;

  update participantes
  set saiu_em = now(), conectado = false
  where id = p_participante;

  perform _toca_sala(v_alvo.sala_id);
end;
$$;

/** Anfitrião escolhe o jogo que aparece destacado no lobby. */
create or replace function definir_jogo(p_sala uuid, p_jogo jogo_id)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exige_anfitriao(p_sala);
  update salas set jogo_atual = p_jogo, atualizada_em = now() where id = p_sala;
end;
$$;

/**
 * Liga/desliga o modo +18. Ligar exige confirmação explícita de que todo mundo
 * na sala é maior de idade e topa o conteúdo — nunca é automático. Desligar não
 * exige nada: o anfitrião corta na hora que quiser.
 */
create or replace function definir_modo_adulto(
  p_sala uuid, p_ativo boolean, p_confirmado boolean default false
)
returns void
language plpgsql security definer set search_path = public as $$
declare v participantes;
begin
  v := _exige_anfitriao(p_sala);

  if p_ativo and not p_confirmado then
    perform _erro('CONFIRMACAO_MAIORIDADE_OBRIGATORIA');
  end if;

  update salas
  set modo_adulto = p_ativo,
      adulto_confirmado_em = case when p_ativo then now() else null end,
      adulto_confirmado_por = case when p_ativo then v.id else null end,
      atualizada_em = now()
  where id = p_sala;
end;
$$;

create or replace function encerrar_sala(p_sala uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exige_anfitriao(p_sala);
  update partidas set status = 'encerrada', encerrada_em = now()
  where sala_id = p_sala and status = 'ativa';
  update salas set status = 'encerrada', encerrada_em = now(), atualizada_em = now()
  where id = p_sala;
end;
$$;

-- ============================================================================
-- 3. PARTIDA E RODADA
-- ============================================================================

/**
 * Prepara o conteúdo de uma rodada de acordo com o jogo: sorteia o que é
 * público (categoria, palavra inicial) e distribui o que é secreto direto na
 * tabela de estados privados, já com a visibilidade correta.
 */
create or replace function _preparar_rodada(p_rodada uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_partida partidas;
  v_sala salas;
  v_carta cartas;
  v_primeiro uuid;
  v_jogador record;
  v_usadas jsonb := '[]'::jsonb;
  v_duracao integer;
  v_fase fase_rodada := 'em_andamento';
begin
  select * into v_rodada from rodadas where id = p_rodada;
  select * into v_partida from partidas where id = v_rodada.partida_id;
  select * into v_sala from salas where id = v_rodada.sala_id;

  -- Quem começa: quem terminou a rodada anterior passa a vez adiante
  if v_rodada.vez_de is null then
    if v_rodada.numero > 1 then
      select vez_de into v_primeiro from rodadas
      where partida_id = v_partida.id and numero = v_rodada.numero - 1;
      v_primeiro := _proximo_jogador(v_sala.id, v_primeiro);
    else
      select id into v_primeiro from participantes
      where sala_id = v_sala.id and saiu_em is null and not eliminado
      order by ordem, id limit 1;
    end if;
  else
    v_primeiro := v_rodada.vez_de;
  end if;

  if v_partida.jogo = 'c-s-composto' then
    v_carta := _sortear_carta('c-s-composto', 'categoria');
    update rodadas set
      estado = jsonb_build_object(
        'categoria', v_carta.conteudo->>'texto',
        'sequencia', jsonb_build_array('C', 'S', 'Composto'),
        'indice', 0,
        'voltas', 0
      ),
      vez_de = v_primeiro
    where id = p_rodada;

  elsif v_partida.jogo = 'palavra-parecida' then
    v_carta := _sortear_carta('palavra-parecida', 'palavra');
    update rodadas set
      estado = jsonb_build_object(
        'palavra_atual', v_carta.conteudo->>'texto',
        'historico', jsonb_build_array(
          jsonb_build_object('palavra', v_carta.conteudo->>'texto', 'autor', null)
        )
      ),
      vez_de = v_primeiro
    where id = p_rodada;

  elsif v_partida.jogo = 'quem-sou-eu' then
    -- Uma identidade diferente por pessoa, escondida justamente de quem a recebeu
    for v_jogador in
      select id from participantes
      where sala_id = v_sala.id and saiu_em is null and not eliminado
      order by ordem, id
    loop
      v_carta := _sortear_carta('quem-sou-eu', 'identidade', false, v_usadas);
      v_usadas := v_usadas || to_jsonb(v_carta.id::text);

      insert into estados_privados
        (sala_id, rodada_id, partida_id, dono_id, tipo, conteudo, visivel_para_dono)
      values (
        v_sala.id, p_rodada, v_partida.id, v_jogador.id, 'identidade',
        v_carta.conteudo, false      -- <<< todo mundo vê, menos o dono
      );
    end loop;

    update rodadas set
      estado = jsonb_build_object(
        'perguntas', '{}'::jsonb,
        'acertaram', jsonb_build_array(),
        'limite_perguntas', coalesce((v_partida.config->>'limitePerguntas')::int, 10),
        'ultima_resposta', null
      ),
      vez_de = v_primeiro
    where id = p_rodada;

  elsif v_partida.jogo = 'mimica' then
    v_carta := _sortear_carta('mimica', 'mimica');
    insert into estados_privados
      (sala_id, rodada_id, partida_id, dono_id, tipo, conteudo, visivel_para_dono)
    values (v_sala.id, p_rodada, v_partida.id, v_primeiro, 'palavra', v_carta.conteudo, true);

    v_fase := 'preparando';   -- o cronômetro só começa quando o mímico mandar
    update rodadas set
      estado = jsonb_build_object(
        'acertos', 0,
        'usadas', jsonb_build_array(v_carta.id::text),
        'palavras_acertadas', jsonb_build_array()
      ),
      vez_de = v_primeiro
    where id = p_rodada;

  elsif v_partida.jogo = 'duas-verdades' then
    v_fase := 'escrevendo';
    v_carta := _sortear_carta('duas-verdades', 'tema');
    update rodadas set
      estado = jsonb_build_object(
        'tema', v_carta.conteudo->>'texto',
        'frases', jsonb_build_array(),
        'votos', 0,
        'total_votantes', greatest(_ativos(v_sala.id) - 1, 0)
      ),
      vez_de = v_primeiro
    where id = p_rodada;

  elsif v_partida.jogo = 'verdade-ou-desafio' then
    update rodadas set
      estado = jsonb_build_object(
        'escolha', null, 'carta', null, 'historico', jsonb_build_array()
      ),
      vez_de = v_primeiro
    where id = p_rodada;

  elsif v_partida.jogo = 'cara-a-cara' then
    -- Mesas são montadas em iniciar_partida; a rodada só acompanha
    update rodadas set
      estado = jsonb_build_object('mesas', (
        select count(*) from duelos where partida_id = v_partida.id
      )),
      vez_de = null
    where id = p_rodada;
  end if;

  v_duracao := _duracao_turno(v_partida.jogo, v_fase);

  update rodadas set
    fase = v_fase,
    turno_inicio = case when v_duracao is null then null else now() end,
    turno_fim = case when v_duracao is null then null
                     else now() + make_interval(secs => v_duracao) end,
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_sala.id);
end;
$$;

/** Anfitrião começa a partida do jogo escolhido. */
create or replace function iniciar_partida(
  p_sala uuid, p_jogo jogo_id, p_config jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_partida partidas;
  v_rodada rodadas;
  v_total integer;
begin
  perform _exige_anfitriao(p_sala);

  select count(*) into v_total from participantes
  where sala_id = p_sala and saiu_em is null;

  if v_total < 2 then perform _erro('POUCOS_JOGADORES'); end if;
  if p_jogo = 'cara-a-cara' and v_total < 2 then perform _erro('POUCOS_JOGADORES'); end if;

  -- Fecha o que estava rolando
  update partidas set status = 'encerrada', encerrada_em = now()
  where sala_id = p_sala and status = 'ativa';

  -- Todo mundo volta para o jogo e a ordem da roda é refeita
  update participantes p
  set eliminado = false,
      ordem = sub.nova_ordem
  from (
    select id, (row_number() over (order by entrou_em, id) - 1)::int as nova_ordem
    from participantes
    where sala_id = p_sala and saiu_em is null
  ) sub
  where p.id = sub.id;

  insert into partidas (sala_id, jogo, config)
  values (p_sala, p_jogo, coalesce(p_config, '{}'::jsonb))
  returning * into v_partida;

  update salas
  set status = 'jogando', jogo_atual = p_jogo, partida_atual = v_partida.id,
      atualizada_em = now()
  where id = p_sala;

  if p_jogo = 'cara-a-cara' then
    perform _montar_duelos(v_partida.id);
  end if;

  insert into rodadas (partida_id, sala_id, numero)
  values (v_partida.id, p_sala, 1)
  returning * into v_rodada;

  perform _preparar_rodada(v_rodada.id);

  return jsonb_build_object('partida_id', v_partida.id, 'rodada_id', v_rodada.id);
end;
$$;

/** Anfitrião puxa a próxima rodada. */
create or replace function proxima_rodada(p_sala uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sala salas;
  v_rodada rodadas;
  v_nova rodadas;
  v_numero integer;
begin
  perform _exige_anfitriao(p_sala);

  select * into v_sala from salas where id = p_sala;
  if v_sala.partida_atual is null then perform _erro('SEM_PARTIDA'); end if;

  v_rodada := _rodada_atual(p_sala);
  v_numero := coalesce(v_rodada.numero, 0) + 1;

  update rodadas set fase = 'encerrada' where id = v_rodada.id and fase <> 'encerrada';

  insert into rodadas (partida_id, sala_id, numero)
  values (v_sala.partida_atual, p_sala, v_numero)
  returning * into v_nova;

  perform _preparar_rodada(v_nova.id);
  return jsonb_build_object('rodada_id', v_nova.id);
end;
$$;

create or replace function encerrar_partida(p_sala uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_sala salas;
begin
  perform _exige_anfitriao(p_sala);
  select * into v_sala from salas where id = p_sala;

  update rodadas set fase = 'encerrada'
  where partida_id = v_sala.partida_atual and fase <> 'encerrada';

  update partidas set status = 'encerrada', encerrada_em = now()
  where id = v_sala.partida_atual;

  update salas set status = 'lobby', partida_atual = null, atualizada_em = now()
  where id = p_sala;
end;
$$;

-- ============================================================================
-- 4. TURNOS (C, S, Composto e Palavra Parecida)
-- ============================================================================

/**
 * Passa a vez. Só quem está na vez pode chamar (o anfitrião também, para
 * destravar mesa parada). Reinicia o cronômetro com horário do servidor.
 *
 * Em "C, S, Composto" a regra caminha C → S → Composto → C…
 * Em "Palavra Parecida" a palavra dita entra no histórico visível a todos.
 */
create or replace function avancar_turno(p_rodada uuid, p_palavra text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_partida partidas;
  v_eu participantes;
  v_proximo uuid;
  v_indice integer;
  v_duracao integer;
  v_estado jsonb;
  v_palavra text := nullif(trim(coalesce(p_palavra, '')), '');
begin
  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;

  v_eu := _exige_participante(v_rodada.sala_id);
  select * into v_partida from partidas where id = v_rodada.partida_id;

  if v_rodada.fase <> 'em_andamento' then perform _erro('RODADA_NAO_ESTA_ABERTA'); end if;
  if v_rodada.vez_de <> v_eu.id and not v_eu.e_anfitriao then
    perform _erro('NAO_E_SUA_VEZ');
  end if;

  -- Bateu o tempo antes do toque: quem estava na vez perde
  if v_rodada.turno_fim is not null and now() > v_rodada.turno_fim then
    perform registrar_timeout(p_rodada);
    return;
  end if;

  v_estado := v_rodada.estado;
  v_proximo := _proximo_jogador(v_rodada.sala_id, v_rodada.vez_de);

  if v_partida.jogo = 'c-s-composto' then
    v_indice := coalesce((v_estado->>'indice')::int, 0) + 1;
    v_estado := jsonb_set(v_estado, '{indice}', to_jsonb(v_indice % 3));
    if v_indice % 3 = 0 then
      v_estado := jsonb_set(v_estado, '{voltas}',
        to_jsonb(coalesce((v_estado->>'voltas')::int, 0) + 1));
    end if;

  elsif v_partida.jogo = 'palavra-parecida' then
    if v_palavra is not null then
      v_estado := jsonb_set(v_estado, '{palavra_atual}', to_jsonb(v_palavra));
      v_estado := jsonb_set(v_estado, '{historico}',
        coalesce(v_estado->'historico', '[]'::jsonb) ||
        jsonb_build_object('palavra', v_palavra, 'autor', v_eu.apelido)
      );

      insert into envios (sala_id, rodada_id, autor_id, tipo, conteudo)
      values (v_rodada.sala_id, p_rodada, v_eu.id, 'palavra',
              jsonb_build_object('texto', v_palavra));
    end if;
  end if;

  v_duracao := _duracao_turno(v_partida.jogo, 'em_andamento');

  update rodadas set
    estado = v_estado,
    vez_de = v_proximo,
    turno_inicio = now(),
    turno_fim = case when v_duracao is null then null
                     else now() + make_interval(secs => v_duracao) end,
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
end;
$$;

/**
 * O tempo acabou. Qualquer cliente pode avisar — o servidor confere no próprio
 * relógio se realmente estourou, então adiantar o celular não adianta nada.
 * A rodada vai para 'resultado' e espera a decisão do anfitrião.
 */
create or replace function registrar_timeout(p_rodada uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_perdedor participantes;
begin
  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;

  perform _exige_participante(v_rodada.sala_id);

  if v_rodada.fase <> 'em_andamento' then return; end if;
  if v_rodada.turno_fim is null or now() < v_rodada.turno_fim then
    perform _erro('AINDA_TEM_TEMPO');
  end if;

  select * into v_perdedor from participantes where id = v_rodada.vez_de;

  update rodadas set
    fase = 'resultado',
    resultado = jsonb_build_object(
      'tipo', 'tempo_esgotado',
      'perdedor_id', v_rodada.vez_de,
      'perdedor', coalesce(v_perdedor.apelido, '—')
    ),
    turno_fim = null,
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
end;
$$;

/**
 * Anfitrião bate o martelo: elimina quem estourou o tempo. Se sobrar uma
 * pessoa só, a partida acaba e ela leva o ponto.
 */
create or replace function confirmar_eliminacao(p_rodada uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_perdedor uuid;
  v_restantes integer;
  v_vencedor participantes;
begin
  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;
  perform _exige_anfitriao(v_rodada.sala_id);

  v_perdedor := (v_rodada.resultado->>'perdedor_id')::uuid;
  if v_perdedor is null then perform _erro('SEM_ELIMINACAO_PENDENTE'); end if;

  update participantes set eliminado = true where id = v_perdedor;

  v_restantes := _ativos(v_rodada.sala_id);

  if v_restantes <= 1 then
    select * into v_vencedor from participantes
    where sala_id = v_rodada.sala_id and saiu_em is null and not eliminado
    limit 1;

    if found then
      perform _pontuar(v_rodada.sala_id, v_rodada.partida_id, p_rodada,
                       v_vencedor.id, 1, 'venceu a rodada');
    end if;

    update rodadas set
      fase = 'encerrada',
      resultado = coalesce(v_rodada.resultado, '{}'::jsonb) ||
        jsonb_build_object('vencedor_id', v_vencedor.id, 'vencedor', v_vencedor.apelido),
      atualizada_em = now()
    where id = p_rodada;

    perform _toca_sala(v_rodada.sala_id);
    return jsonb_build_object('fim', true, 'vencedor', v_vencedor.apelido);
  end if;

  -- Ainda tem gente: segue o jogo do próximo
  update rodadas set
    fase = 'em_andamento',
    vez_de = _proximo_jogador(v_rodada.sala_id, v_perdedor),
    resultado = null,
    turno_inicio = now(),
    turno_fim = now() + make_interval(secs => coalesce(
      _duracao_turno((select jogo from partidas where id = v_rodada.partida_id), 'em_andamento'), 5)),
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
  return jsonb_build_object('fim', false, 'restantes', v_restantes);
end;
$$;

/** A mesa achou que a resposta valia: ninguém sai, o turno recomeça. */
create or replace function reiniciar_turno(p_rodada uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_duracao integer;
begin
  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;
  perform _exige_anfitriao(v_rodada.sala_id);

  v_duracao := coalesce(_duracao_turno(
    (select jogo from partidas where id = v_rodada.partida_id), 'em_andamento'), 5);

  update rodadas set
    fase = 'em_andamento',
    resultado = null,
    turno_inicio = now(),
    turno_fim = now() + make_interval(secs => v_duracao),
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
end;
$$;

/** Anfitrião pula a vez de quem caiu da sala. */
create or replace function pular_vez(p_rodada uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_duracao integer;
begin
  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;
  perform _exige_anfitriao(v_rodada.sala_id);

  v_duracao := _duracao_turno(
    (select jogo from partidas where id = v_rodada.partida_id), 'em_andamento');

  update rodadas set
    fase = 'em_andamento',
    resultado = null,
    vez_de = _proximo_jogador(v_rodada.sala_id, v_rodada.vez_de),
    turno_inicio = case when v_duracao is null then null else now() end,
    turno_fim = case when v_duracao is null then null
                     else now() + make_interval(secs => v_duracao) end,
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
end;
$$;

-- ============================================================================
-- 5. MÍMICA
-- ============================================================================

/** O mímico aperta "começar": cronômetro de 60s roda igual para a sala toda. */
create or replace function mimica_iniciar(p_rodada uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_eu participantes;
begin
  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;

  v_eu := _exige_participante(v_rodada.sala_id);
  if v_rodada.vez_de <> v_eu.id and not v_eu.e_anfitriao then
    perform _erro('NAO_E_SUA_VEZ');
  end if;

  update rodadas set
    fase = 'em_andamento',
    turno_inicio = now(),
    turno_fim = now() + interval '60 seconds',
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
end;
$$;

/** Acertaram: ponto para o mímico e uma palavra nova, ainda dentro dos 60s. */
create or replace function mimica_acertou(p_rodada uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_eu participantes;
  v_carta cartas;
  v_palavra text;
  v_usadas jsonb;
  v_acertos integer;
begin
  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;

  v_eu := _exige_participante(v_rodada.sala_id);
  if v_rodada.vez_de <> v_eu.id and not v_eu.e_anfitriao then
    perform _erro('NAO_E_SUA_VEZ');
  end if;
  if v_rodada.fase <> 'em_andamento' then perform _erro('RODADA_NAO_ESTA_ABERTA'); end if;
  if v_rodada.turno_fim is not null and now() > v_rodada.turno_fim then
    perform _erro('TEMPO_ESGOTADO');
  end if;

  select conteudo->>'texto' into v_palavra from estados_privados
  where rodada_id = p_rodada and dono_id = v_rodada.vez_de and tipo = 'palavra';

  v_acertos := coalesce((v_rodada.estado->>'acertos')::int, 0) + 1;
  v_usadas := coalesce(v_rodada.estado->'usadas', '[]'::jsonb);

  perform _pontuar(v_rodada.sala_id, v_rodada.partida_id, p_rodada,
                   v_rodada.vez_de, 1, 'mímica adivinhada');

  -- Sorteia a próxima palavra e troca o segredo do mímico
  v_carta := _sortear_carta('mimica', 'mimica', false, v_usadas);

  update estados_privados
  set conteudo = v_carta.conteudo, criado_em = now()
  where rodada_id = p_rodada and dono_id = v_rodada.vez_de and tipo = 'palavra';

  update rodadas set
    estado = v_rodada.estado
      || jsonb_build_object('acertos', v_acertos)
      || jsonb_build_object('usadas', v_usadas || to_jsonb(v_carta.id::text))
      || jsonb_build_object('palavras_acertadas',
           coalesce(v_rodada.estado->'palavras_acertadas', '[]'::jsonb)
           || to_jsonb(coalesce(v_palavra, '—'))),
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
  return jsonb_build_object('acertos', v_acertos);
end;
$$;

/** Fim dos 60 segundos: mostra o placar da vez. */
create or replace function mimica_encerrar(p_rodada uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_apelido text;
begin
  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;
  perform _exige_participante(v_rodada.sala_id);

  if v_rodada.fase = 'resultado' or v_rodada.fase = 'encerrada' then return; end if;

  select apelido into v_apelido from participantes where id = v_rodada.vez_de;

  update rodadas set
    fase = 'resultado',
    resultado = jsonb_build_object(
      'tipo', 'mimica_fim',
      'jogador', coalesce(v_apelido, '—'),
      'jogador_id', v_rodada.vez_de,
      'acertos', coalesce((v_rodada.estado->>'acertos')::int, 0),
      'palavras', coalesce(v_rodada.estado->'palavras_acertadas', '[]'::jsonb)
    ),
    turno_fim = null,
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
end;
$$;

-- ============================================================================
-- 6. QUEM SOU EU?
-- ============================================================================

/** O grupo responde Sim / Não / Talvez para a pergunta falada. */
create or replace function quem_sou_eu_responder(p_rodada uuid, p_resposta text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_eu participantes;
  v_chave text;
  v_perguntas jsonb;
  v_feitas integer;
begin
  if p_resposta not in ('sim', 'nao', 'talvez') then perform _erro('RESPOSTA_INVALIDA'); end if;

  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;

  v_eu := _exige_participante(v_rodada.sala_id);
  if v_eu.id = v_rodada.vez_de then perform _erro('QUEM_PERGUNTA_NAO_RESPONDE'); end if;

  v_chave := v_rodada.vez_de::text;
  v_perguntas := coalesce(v_rodada.estado->'perguntas', '{}'::jsonb);
  v_feitas := coalesce((v_perguntas->>v_chave)::int, 0) + 1;

  insert into envios (sala_id, rodada_id, autor_id, tipo, conteudo)
  values (v_rodada.sala_id, p_rodada, v_eu.id, 'resposta',
          jsonb_build_object('resposta', p_resposta, 'para', v_rodada.vez_de));

  update rodadas set
    estado = v_rodada.estado
      || jsonb_build_object('perguntas', jsonb_set(v_perguntas, array[v_chave], to_jsonb(v_feitas)))
      || jsonb_build_object('ultima_resposta',
           jsonb_build_object('resposta', p_resposta, 'por', v_eu.apelido)),
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
end;
$$;

/**
 * O palpite. Acertou: ponto, identidade revelada para todos (inclusive para a
 * própria pessoa) e a vez passa. Errou: só passa a vez.
 */
create or replace function quem_sou_eu_palpite(p_rodada uuid, p_palpite text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_eu participantes;
  v_identidade text;
  v_acertou boolean;
  v_acertaram jsonb;
begin
  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;

  v_eu := _exige_participante(v_rodada.sala_id);
  if v_rodada.vez_de <> v_eu.id then perform _erro('NAO_E_SUA_VEZ'); end if;

  select conteudo->>'nome' into v_identidade from estados_privados
  where rodada_id = p_rodada and dono_id = v_eu.id and tipo = 'identidade';

  -- Comparação tolerante: ignora caixa, acentos e espaços sobrando
  v_acertou := lower(unaccent_simples(trim(coalesce(p_palpite, ''))))
             = lower(unaccent_simples(coalesce(v_identidade, '')));

  insert into envios (sala_id, rodada_id, autor_id, tipo, conteudo)
  values (v_rodada.sala_id, p_rodada, v_eu.id, 'palpite',
          jsonb_build_object('texto', p_palpite, 'acertou', v_acertou));

  if v_acertou then
    perform _pontuar(v_rodada.sala_id, v_rodada.partida_id, p_rodada,
                     v_eu.id, 1, 'descobriu a identidade');

    -- Agora a pessoa pode ver quem era
    update estados_privados set visivel_para_dono = true
    where rodada_id = p_rodada and dono_id = v_eu.id and tipo = 'identidade';

    v_acertaram := coalesce(v_rodada.estado->'acertaram', '[]'::jsonb)
      || jsonb_build_object('id', v_eu.id, 'apelido', v_eu.apelido, 'identidade', v_identidade);

    update rodadas set
      estado = v_rodada.estado || jsonb_build_object('acertaram', v_acertaram),
      atualizada_em = now()
    where id = p_rodada;
  end if;

  -- Acertando ou não, a roda gira
  update rodadas set
    vez_de = _proximo_jogador(v_rodada.sala_id, v_eu.id),
    estado = (select estado from rodadas where id = p_rodada)
      || jsonb_build_object('ultima_resposta', null),
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
  return jsonb_build_object('acertou', v_acertou, 'identidade',
    case when v_acertou then v_identidade else null end);
end;
$$;

/** Normalização simples de acentos, sem depender da extensão unaccent. */
create or replace function unaccent_simples(p_texto text)
returns text language sql immutable as $$
  select translate(
    coalesce(p_texto, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  );
$$;

-- ============================================================================
-- 7. DUAS VERDADES E UMA MENTIRA
-- ============================================================================

/**
 * A pessoa da vez escreve as três frases numa tela privada. As frases vão
 * embaralhadas para o estado compartilhado; qual delas é a mentira fica
 * guardada em estado privado, visível só para quem escreveu.
 */
create or replace function duas_verdades_enviar(
  p_rodada uuid, p_frases text[], p_indice_mentira integer
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_eu participantes;
  v_ordem integer[];
  v_embaralhadas jsonb := '[]'::jsonb;
  v_nova_mentira integer;
  i integer;
begin
  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;

  v_eu := _exige_participante(v_rodada.sala_id);
  if v_rodada.vez_de <> v_eu.id then perform _erro('NAO_E_SUA_VEZ'); end if;
  if array_length(p_frases, 1) <> 3 then perform _erro('PRECISA_TRES_FRASES'); end if;
  if p_indice_mentira < 0 or p_indice_mentira > 2 then perform _erro('INDICE_INVALIDO'); end if;

  for i in 1..3 loop
    if char_length(trim(coalesce(p_frases[i], ''))) < 2 then perform _erro('FRASE_VAZIA'); end if;
  end loop;

  -- Embaralha para a mentira não cair sempre na mesma posição
  select array_agg(x order by random()) into v_ordem from generate_series(1, 3) x;

  for i in 1..3 loop
    v_embaralhadas := v_embaralhadas || to_jsonb(trim(p_frases[v_ordem[i]]));
    if v_ordem[i] = p_indice_mentira + 1 then v_nova_mentira := i - 1; end if;
  end loop;

  insert into estados_privados
    (sala_id, rodada_id, partida_id, dono_id, tipo, conteudo, visivel_para_dono)
  values (v_rodada.sala_id, p_rodada, v_rodada.partida_id, v_eu.id, 'frases',
          jsonb_build_object('mentira', v_nova_mentira), true)
  on conflict (coalesce(rodada_id, partida_id), dono_id, tipo)
  do update set conteudo = excluded.conteudo;

  update rodadas set
    fase = 'votacao',
    estado = v_rodada.estado
      || jsonb_build_object('frases', v_embaralhadas)
      || jsonb_build_object('votos', 0)
      || jsonb_build_object('total_votantes', greatest(_ativos(v_rodada.sala_id) - 1, 0)),
    turno_inicio = now(),
    turno_fim = now() + make_interval(secs => coalesce(
      _duracao_turno('duas-verdades', 'votacao'), 60)),
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
end;
$$;

/** Voto secreto: fica invisível para a sala até a revelação. */
create or replace function duas_verdades_votar(p_rodada uuid, p_indice integer)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_eu participantes;
  v_total integer;
begin
  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;

  v_eu := _exige_participante(v_rodada.sala_id);
  if v_rodada.fase <> 'votacao' then perform _erro('VOTACAO_FECHADA'); end if;
  if v_eu.id = v_rodada.vez_de then perform _erro('AUTOR_NAO_VOTA'); end if;
  if p_indice < 0 or p_indice > 2 then perform _erro('INDICE_INVALIDO'); end if;

  insert into votos (sala_id, rodada_id, votante_id, alvo)
  values (v_rodada.sala_id, p_rodada, v_eu.id, p_indice::text)
  on conflict (rodada_id, votante_id) do update set alvo = excluded.alvo;

  select count(*) into v_total from votos where rodada_id = p_rodada;

  -- Só o NÚMERO de votos é público enquanto a votação corre
  update rodadas set
    estado = v_rodada.estado || jsonb_build_object('votos', v_total),
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);

  if v_total >= coalesce((v_rodada.estado->>'total_votantes')::int, 0) then
    perform duas_verdades_revelar(p_rodada);
  end if;
end;
$$;

/**
 * Revela. Ponto para cada pessoa que achou a mentira e um ponto para o autor
 * por cada pessoa que ele enganou.
 */
create or replace function duas_verdades_revelar(p_rodada uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_mentira integer;
  v_autor participantes;
  v_voto record;
  v_acertos integer := 0;
  v_enganados integer := 0;
  v_detalhes jsonb := '[]'::jsonb;
begin
  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;
  perform _exige_participante(v_rodada.sala_id);
  if v_rodada.fase not in ('votacao', 'em_andamento') then return v_rodada.resultado; end if;

  select (conteudo->>'mentira')::int into v_mentira from estados_privados
  where rodada_id = p_rodada and dono_id = v_rodada.vez_de and tipo = 'frases';

  select * into v_autor from participantes where id = v_rodada.vez_de;

  for v_voto in
    select v.votante_id, v.alvo, p.apelido from votos v
    join participantes p on p.id = v.votante_id
    where v.rodada_id = p_rodada
  loop
    if v_voto.alvo::int = v_mentira then
      v_acertos := v_acertos + 1;
      perform _pontuar(v_rodada.sala_id, v_rodada.partida_id, p_rodada,
                       v_voto.votante_id, 1, 'achou a mentira');
    else
      v_enganados := v_enganados + 1;
    end if;

    v_detalhes := v_detalhes || jsonb_build_object(
      'apelido', v_voto.apelido, 'voto', v_voto.alvo::int,
      'acertou', v_voto.alvo::int = v_mentira
    );
  end loop;

  if v_enganados > 0 then
    perform _pontuar(v_rodada.sala_id, v_rodada.partida_id, p_rodada,
                     v_rodada.vez_de, v_enganados, 'enganou a mesa');
  end if;

  -- Agora os votos podem aparecer para todo mundo
  update votos set revelado = true where rodada_id = p_rodada;

  update rodadas set
    fase = 'resultado',
    turno_fim = null,
    resultado = jsonb_build_object(
      'tipo', 'duas_verdades',
      'mentira', v_mentira,
      'autor', v_autor.apelido,
      'autor_id', v_autor.id,
      'acertos', v_acertos,
      'enganados', v_enganados,
      'votos', v_detalhes
    ),
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
  return jsonb_build_object('mentira', v_mentira, 'acertos', v_acertos);
end;
$$;

-- ============================================================================
-- 8. VERDADE OU DESAFIO (com pacote +18 opcional)
-- ============================================================================

/**
 * Sorteia a carta. O modo +18 só entra se a sala tiver o modo ligado E o
 * anfitrião tiver confirmado a maioridade — nunca por acaso.
 */
create or replace function verdade_desafio_sortear(
  p_rodada uuid, p_tipo text, p_adulto boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_sala salas;
  v_eu participantes;
  v_carta cartas;
  v_usar_adulto boolean;
begin
  if p_tipo not in ('verdade', 'desafio') then perform _erro('TIPO_INVALIDO'); end if;

  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;

  v_eu := _exige_participante(v_rodada.sala_id);
  if v_rodada.vez_de <> v_eu.id and not v_eu.e_anfitriao then
    perform _erro('NAO_E_SUA_VEZ');
  end if;

  select * into v_sala from salas where id = v_rodada.sala_id;

  v_usar_adulto := p_adulto and v_sala.modo_adulto and v_sala.adulto_confirmado_em is not null;
  if p_adulto and not v_usar_adulto then perform _erro('MODO_ADULTO_DESLIGADO'); end if;

  v_carta := _sortear_carta('verdade-ou-desafio', p_tipo, v_usar_adulto);

  update rodadas set
    fase = 'em_andamento',
    estado = v_rodada.estado || jsonb_build_object(
      'escolha', p_tipo,
      'adulto', v_usar_adulto,
      'carta', jsonb_build_object('id', v_carta.id, 'texto', v_carta.conteudo->>'texto')
    ),
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
  return jsonb_build_object('texto', v_carta.conteudo->>'texto');
end;
$$;

/**
 * Concluir, pular ou trocar a carta. Pular e trocar não geram punição nenhuma —
 * "não me sinto confortável" é uma saída legítima e fica registrada sem drama.
 */
create or replace function verdade_desafio_resolver(p_rodada uuid, p_acao text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rodada rodadas;
  v_eu participantes;
  v_apelido text;
  v_historico jsonb;
begin
  if p_acao not in ('concluir', 'pular', 'desconfortavel') then perform _erro('ACAO_INVALIDA'); end if;

  select * into v_rodada from rodadas where id = p_rodada;
  if not found then perform _erro('RODADA_NAO_ENCONTRADA'); end if;

  v_eu := _exige_participante(v_rodada.sala_id);
  if v_rodada.vez_de <> v_eu.id and not v_eu.e_anfitriao then
    perform _erro('NAO_E_SUA_VEZ');
  end if;

  select apelido into v_apelido from participantes where id = v_rodada.vez_de;

  v_historico := coalesce(v_rodada.estado->'historico', '[]'::jsonb) || jsonb_build_object(
    'apelido', v_apelido,
    'escolha', v_rodada.estado->>'escolha',
    'texto', v_rodada.estado#>>'{carta,texto}',
    'acao', p_acao
  );

  if p_acao = 'concluir' then
    perform _pontuar(v_rodada.sala_id, v_rodada.partida_id, p_rodada,
                     v_rodada.vez_de, 1, 'encarou a carta');
  end if;

  update rodadas set
    estado = v_rodada.estado
      || jsonb_build_object('historico', v_historico)
      || jsonb_build_object('escolha', null, 'carta', null),
    vez_de = _proximo_jogador(v_rodada.sala_id, v_rodada.vez_de),
    atualizada_em = now()
  where id = p_rodada;

  perform _toca_sala(v_rodada.sala_id);
end;
$$;

-- ============================================================================
-- 9. CARA A CARA
-- ============================================================================

/**
 * Monta as mesas: pares na ordem da roda. Cada jogador recebe um personagem
 * secreto — visível só para ele; é justamente o que o adversário precisa
 * descobrir. Ímpar sobrando fica de fora da mesa e assiste.
 */
create or replace function _montar_duelos(p_partida uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_partida partidas;
  v_ids uuid[];
  v_painel jsonb;
  v_carta cartas;
  v_usadas jsonb := '[]'::jsonb;
  v_mesa integer := 1;
  i integer;
begin
  select * into v_partida from partidas where id = p_partida;

  select array_agg(id order by ordem, id) into v_ids from participantes
  where sala_id = v_partida.sala_id and saiu_em is null and not eliminado;

  -- O painel de personagens é o mesmo para todo mundo
  select jsonb_agg(jsonb_build_object('id', c.id, 'p', c.conteudo))
  into v_painel
  from (
    select id, conteudo from cartas
    where jogo = 'cara-a-cara' and tipo = 'personagem' and ativo
    order by (conteudo->>'nome')
  ) c;

  update partidas set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('painel', v_painel)
  where id = p_partida;

  i := 1;
  while i <= array_length(v_ids, 1) - 1 loop
    insert into duelos (sala_id, partida_id, mesa, jogador_a, jogador_b, vez_de)
    values (v_partida.sala_id, p_partida, v_mesa, v_ids[i], v_ids[i + 1], v_ids[i]);

    -- Cada um guarda o próprio personagem; o adversário é quem precisa adivinhar
    v_carta := _sortear_carta('cara-a-cara', 'personagem', false, v_usadas);
    v_usadas := v_usadas || to_jsonb(v_carta.id::text);
    insert into estados_privados
      (sala_id, rodada_id, partida_id, dono_id, tipo, conteudo, visivel_para_dono)
    values (v_partida.sala_id, null, p_partida, v_ids[i], 'personagem',
            v_carta.conteudo || jsonb_build_object('carta_id', v_carta.id), true);

    v_carta := _sortear_carta('cara-a-cara', 'personagem', false, v_usadas);
    v_usadas := v_usadas || to_jsonb(v_carta.id::text);
    insert into estados_privados
      (sala_id, rodada_id, partida_id, dono_id, tipo, conteudo, visivel_para_dono)
    values (v_partida.sala_id, null, p_partida, v_ids[i + 1], 'personagem',
            v_carta.conteudo || jsonb_build_object('carta_id', v_carta.id), true);

    v_mesa := v_mesa + 1;
    i := i + 2;
  end loop;
end;
$$;

/** Meu duelo nesta partida (ou null se estou só assistindo). */
create or replace function _meu_duelo(p_duelo uuid)
returns duelos
language plpgsql stable security definer set search_path = public as $$
declare
  v_duelo duelos;
  v_eu participantes;
begin
  select * into v_duelo from duelos where id = p_duelo;
  if not found then perform _erro('DUELO_NAO_ENCONTRADO'); end if;

  v_eu := _exige_participante(v_duelo.sala_id);
  if v_eu.id <> v_duelo.jogador_a and v_eu.id <> v_duelo.jogador_b then
    perform _erro('NAO_E_SUA_MESA');
  end if;
  return v_duelo;
end;
$$;

create or replace function cara_a_cara_perguntar(p_duelo uuid, p_pergunta text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_duelo duelos;
  v_eu participantes;
begin
  v_duelo := _meu_duelo(p_duelo);
  v_eu := _exige_participante(v_duelo.sala_id);

  if v_duelo.vez_de <> v_eu.id then perform _erro('NAO_E_SUA_VEZ'); end if;
  if v_duelo.fase <> 'perguntando' then perform _erro('AGUARDE_A_RESPOSTA'); end if;
  if char_length(trim(coalesce(p_pergunta, ''))) < 3 then perform _erro('PERGUNTA_CURTA'); end if;

  update duelos set
    fase = 'respondendo',
    pergunta_atual = trim(p_pergunta),
    atualizado_em = now()
  where id = p_duelo;

  perform _toca_sala(v_duelo.sala_id);
end;
$$;

create or replace function cara_a_cara_responder(p_duelo uuid, p_resposta text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_duelo duelos;
  v_eu participantes;
begin
  if p_resposta not in ('sim', 'nao') then perform _erro('RESPOSTA_INVALIDA'); end if;

  v_duelo := _meu_duelo(p_duelo);
  v_eu := _exige_participante(v_duelo.sala_id);

  if v_duelo.fase <> 'respondendo' then perform _erro('NADA_PARA_RESPONDER'); end if;
  if v_duelo.vez_de = v_eu.id then perform _erro('QUEM_PERGUNTA_NAO_RESPONDE'); end if;

  update duelos set
    fase = 'perguntando',
    historico = historico || jsonb_build_object(
      'pergunta', v_duelo.pergunta_atual, 'resposta', p_resposta, 'de', v_eu.apelido
    ),
    pergunta_atual = null,
    -- Quem acabou de responder passa a perguntar: as perguntas se alternam
    vez_de = v_eu.id,
    atualizado_em = now()
  where id = p_duelo;

  perform _toca_sala(v_duelo.sala_id);
end;
$$;

/** Marca/desmarca personagem eliminado. É anotação particular: o adversário não vê. */
create or replace function cara_a_cara_eliminar(
  p_duelo uuid, p_carta_id uuid, p_marcado boolean
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_duelo duelos;
  v_eu participantes;
  v_lista jsonb;
begin
  v_duelo := _meu_duelo(p_duelo);
  v_eu := _exige_participante(v_duelo.sala_id);

  select conteudo->'ids' into v_lista from estados_privados
  where partida_id = v_duelo.partida_id and dono_id = v_eu.id and tipo = 'eliminados';

  v_lista := coalesce(v_lista, '[]'::jsonb);

  if p_marcado then
    if not (v_lista @> to_jsonb(p_carta_id::text)) then
      v_lista := v_lista || to_jsonb(p_carta_id::text);
    end if;
  else
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_lista
    from jsonb_array_elements_text(v_lista) x
    where x <> p_carta_id::text;
  end if;

  insert into estados_privados
    (sala_id, rodada_id, partida_id, dono_id, tipo, conteudo, visivel_para_dono)
  values (v_duelo.sala_id, null, v_duelo.partida_id, v_eu.id, 'eliminados',
          jsonb_build_object('ids', v_lista), true)
  on conflict (coalesce(rodada_id, partida_id), dono_id, tipo)
  do update set conteudo = excluded.conteudo;
end;
$$;

/** O palpite decide a mesa: acertou, venceu; errou, o adversário leva. */
create or replace function cara_a_cara_palpite(p_duelo uuid, p_carta_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_duelo duelos;
  v_eu participantes;
  v_outro uuid;
  v_alvo uuid;
  v_acertou boolean;
  v_vencedor uuid;
  v_nome text;
begin
  v_duelo := _meu_duelo(p_duelo);
  v_eu := _exige_participante(v_duelo.sala_id);

  if v_duelo.fase = 'encerrado' then perform _erro('DUELO_ENCERRADO'); end if;

  v_outro := case when v_duelo.jogador_a = v_eu.id then v_duelo.jogador_b else v_duelo.jogador_a end;

  -- O alvo é o personagem que o ADVERSÁRIO guarda
  select (conteudo->>'carta_id')::uuid, conteudo->>'nome' into v_alvo, v_nome
  from estados_privados
  where partida_id = v_duelo.partida_id and dono_id = v_outro and tipo = 'personagem';

  v_acertou := v_alvo = p_carta_id;
  v_vencedor := case when v_acertou then v_eu.id else v_outro end;

  perform _pontuar(v_duelo.sala_id, v_duelo.partida_id, null, v_vencedor, 1,
                   case when v_acertou then 'acertou o personagem' else 'adversário errou o palpite' end);

  update duelos set
    fase = 'encerrado',
    vencedor_id = v_vencedor,
    motivo_fim = case when v_acertou then 'palpite certeiro' else 'palpite errado' end,
    historico = historico || jsonb_build_object(
      'palpite', v_nome, 'de', v_eu.apelido, 'acertou', v_acertou
    ),
    atualizado_em = now()
  where id = p_duelo;

  perform _toca_sala(v_duelo.sala_id);
  return jsonb_build_object('acertou', v_acertou, 'personagem', v_nome);
end;
$$;

-- ============================================================================
-- 10. LEITURA: o estado inteiro da sala em uma chamada
-- ============================================================================

/**
 * Devolve tudo que a sala compartilha, em um JSON só. O cliente chama isto ao
 * entrar e a cada evento do Realtime — é mais simples (e mais difícil de
 * bagunçar) do que costurar deltas na mão.
 *
 * `servidor_agora` viaja junto para o cliente calcular a diferença entre o
 * relógio dele e o do servidor, e o cronômetro bater igual em todo mundo.
 */
create or replace function estado_da_sala(p_sala uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_sala salas;
  v_eu participantes;
  v_rodada rodadas;
  v_partida partidas;
begin
  v_eu := _exige_participante(p_sala);
  select * into v_sala from salas where id = p_sala;
  select * into v_partida from partidas where id = v_sala.partida_atual;
  v_rodada := _rodada_atual(p_sala);

  return jsonb_build_object(
    'servidor_agora', now(),
    'eu', jsonb_build_object(
      'id', v_eu.id, 'apelido', v_eu.apelido, 'cor', v_eu.cor,
      'e_anfitriao', v_eu.e_anfitriao, 'pontos', v_eu.pontos, 'eliminado', v_eu.eliminado
    ),
    'sala', jsonb_build_object(
      'id', v_sala.id, 'codigo', v_sala.codigo, 'nome', v_sala.nome,
      'status', v_sala.status, 'jogo_atual', v_sala.jogo_atual,
      'modo_adulto', v_sala.modo_adulto,
      'adulto_confirmado_em', v_sala.adulto_confirmado_em,
      'anfitriao_id', v_sala.anfitriao_id
    ),
    'participantes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'apelido', p.apelido, 'cor', p.cor, 'e_anfitriao', p.e_anfitriao,
        'conectado', p.conectado and p.visto_em > now() - interval '30 seconds',
        'pontos', p.pontos, 'eliminado', p.eliminado, 'ordem', p.ordem
      ) order by p.ordem, p.id)
      from participantes p where p.sala_id = p_sala and p.saiu_em is null
    ), '[]'::jsonb),
    'partida', case when v_partida.id is null then null else jsonb_build_object(
      'id', v_partida.id, 'jogo', v_partida.jogo, 'status', v_partida.status,
      'config', v_partida.config
    ) end,
    'rodada', case when v_rodada.id is null then null else jsonb_build_object(
      'id', v_rodada.id, 'numero', v_rodada.numero, 'fase', v_rodada.fase,
      'vez_de', v_rodada.vez_de, 'estado', v_rodada.estado,
      'turno_inicio', v_rodada.turno_inicio, 'turno_fim', v_rodada.turno_fim,
      'resultado', v_rodada.resultado
    ) end,
    'duelos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'mesa', d.mesa, 'jogador_a', d.jogador_a, 'jogador_b', d.jogador_b,
        'vez_de', d.vez_de, 'fase', d.fase, 'pergunta_atual', d.pergunta_atual,
        'historico', d.historico, 'vencedor_id', d.vencedor_id, 'motivo_fim', d.motivo_fim
      ) order by d.mesa)
      from duelos d where d.partida_id = v_sala.partida_atual
    ), '[]'::jsonb)
  );
end;
$$;

/** Relógio do servidor, para sincronizar cronômetros. */
create or replace function agora()
returns timestamptz language sql stable as $$ select now(); $$;

-- ----------------------------------------------------------------- Grants

grant execute on function
  criar_sala(text, text), entrar_sala(text, text), sair_sala(uuid),
  ping_presenca(uuid), varrer_ausentes(uuid), remover_participante(uuid),
  definir_jogo(uuid, jogo_id), definir_modo_adulto(uuid, boolean, boolean),
  encerrar_sala(uuid),
  iniciar_partida(uuid, jogo_id, jsonb), proxima_rodada(uuid), encerrar_partida(uuid),
  avancar_turno(uuid, text), registrar_timeout(uuid), confirmar_eliminacao(uuid),
  reiniciar_turno(uuid), pular_vez(uuid),
  mimica_iniciar(uuid), mimica_acertou(uuid), mimica_encerrar(uuid),
  quem_sou_eu_responder(uuid, text), quem_sou_eu_palpite(uuid, text),
  duas_verdades_enviar(uuid, text[], integer), duas_verdades_votar(uuid, integer),
  duas_verdades_revelar(uuid),
  verdade_desafio_sortear(uuid, text, boolean), verdade_desafio_resolver(uuid, text),
  cara_a_cara_perguntar(uuid, text), cara_a_cara_responder(uuid, text),
  cara_a_cara_eliminar(uuid, uuid, boolean), cara_a_cara_palpite(uuid, uuid),
  estado_da_sala(uuid), agora()
to authenticated;
