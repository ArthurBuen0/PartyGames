-- =============================================================================
-- Party Games — Realtime
-- =============================================================================
-- Publica as tabelas da sala no canal de tempo real do Supabase.
--
-- Ponto importante: o Realtime respeita o RLS. Como a política de
-- `estados_privados` já filtra por dono, o segredo também não vaza pelo canal —
-- quem não pode ver a linha simplesmente não recebe o evento.
--
-- REPLICA IDENTITY FULL faz o evento carregar a linha inteira (e não só a
-- chave), que é o que permite filtrar por sala_id no cliente.
-- =============================================================================

alter table salas             replica identity full;
alter table participantes     replica identity full;
alter table partidas          replica identity full;
alter table rodadas           replica identity full;
alter table estados_privados  replica identity full;
alter table envios            replica identity full;
alter table votos             replica identity full;
alter table avaliacoes        replica identity full;
alter table etapas_desenho    replica identity full;
alter table pontuacoes        replica identity full;
alter table duelos            replica identity full;

do $$
declare
  v_tabela text;
begin
  -- Em bancos que não são Supabase (ex.: PGlite nos testes) a publicação não
  -- existe: nesse caso não há nada para fazer.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publicação supabase_realtime não existe — pulando.';
    return;
  end if;

  foreach v_tabela in array array[
    'salas', 'participantes', 'partidas', 'rodadas',
    'estados_privados', 'envios', 'votos', 'avaliacoes', 'etapas_desenho',
    'pontuacoes', 'duelos'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_tabela
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_tabela);
    end if;
  end loop;
end $$;
