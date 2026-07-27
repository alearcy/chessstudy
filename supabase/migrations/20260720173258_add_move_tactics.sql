alter table public.moves
add column tactics jsonb not null default '[]'::jsonb;

alter table public.moves
add constraint moves_tactics_array_check
check (jsonb_typeof(tactics) = 'array');

-- Mantiene atomiche le RPC esistenti senza duplicarne l'intero corpo: il
-- wrapper richiama la versione precedente e completa il nuovo campo nella
-- stessa transazione.
alter function public.save_lesson_tree(bigint, jsonb, jsonb, jsonb, boolean)
rename to save_lesson_tree_without_tactics;

create or replace function public.save_lesson_tree(
  p_lesson_id bigint,
  p_lesson jsonb,
  p_board jsonb,
  p_moves jsonb,
  p_replace boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  v_result := public.save_lesson_tree_without_tactics(
    p_lesson_id, p_lesson, p_board, p_moves, p_replace
  );

  update public.moves as stored_move
  set tactics = coalesce(v_move -> 'tactics', '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_moves, '[]'::jsonb)) as v_move
  where stored_move.user_id = (select auth.uid())
    and stored_move.board_id = (v_result ->> 'board_id')::bigint
    and stored_move.move_order = (v_move ->> 'move_order')::integer;

  return v_result;
end;
$$;

revoke execute on function public.save_lesson_tree(
  bigint, jsonb, jsonb, jsonb, boolean
) from public, anon;
grant execute on function public.save_lesson_tree(
  bigint, jsonb, jsonb, jsonb, boolean
) to authenticated;

alter function public.save_board_line(bigint, bigint, jsonb, jsonb)
rename to save_board_line_without_tactics;

create or replace function public.save_board_line(
  p_lesson_id bigint,
  p_board_id bigint,
  p_board jsonb,
  p_moves jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  v_result := public.save_board_line_without_tactics(
    p_lesson_id, p_board_id, p_board, p_moves
  );

  update public.moves as stored_move
  set tactics = coalesce(v_move -> 'tactics', '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_moves, '[]'::jsonb)) as v_move
  where stored_move.user_id = (select auth.uid())
    and stored_move.board_id = (v_result ->> 'board_id')::bigint
    and stored_move.move_order = (v_move ->> 'move_order')::integer;

  return v_result;
end;
$$;

revoke execute on function public.save_board_line(
  bigint, bigint, jsonb, jsonb
) from public, anon;
grant execute on function public.save_board_line(
  bigint, bigint, jsonb, jsonb
) to authenticated;

alter function public.import_database_backup_v1(jsonb)
rename to import_database_backup_v1_without_tactics;

create or replace function public.import_database_backup_v1(
  p_backup jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  v_result := public.import_database_backup_v1_without_tactics(p_backup);

  update public.moves as stored_move
  set tactics = coalesce(v_move -> 'tactics', '[]'::jsonb)
  from jsonb_array_elements(p_backup #> '{data,moves}') as v_move
  where stored_move.user_id = (select auth.uid())
    and stored_move.uid = (v_move ->> 'uid')::uuid;

  return v_result;
end;
$$;

revoke execute on function public.import_database_backup_v1(jsonb)
from public, anon;
grant execute on function public.import_database_backup_v1(jsonb)
to authenticated;
