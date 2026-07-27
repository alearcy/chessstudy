create or replace function public.duplicate_study_board(
  p_source_board_id bigint
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_source_board public.boards%rowtype;
  v_source_move public.moves%rowtype;
  v_board_order integer;
  v_board_id bigint;
  v_parent_id bigint;
  v_move_id bigint;
  v_move_id_map jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Autenticazione richiesta.' using errcode = '42501';
  end if;

  select b.* into v_source_board
  from public.boards b
  join public.lessons l
    on l.id = b.lesson_id
   and l.user_id = b.user_id
  where b.id = p_source_board_id
    and b.user_id = v_user_id
    and l.mode = 'study';

  if v_source_board.id is null then
    raise exception 'Scacchiera di studio non disponibile.'
      using errcode = 'P0002';
  end if;

  select coalesce(max(board_order), -1) + 1
  into v_board_order
  from public.boards
  where lesson_id = v_source_board.lesson_id
    and user_id = v_user_id;

  insert into public.boards (
    user_id, uid, lesson_id, title, fen, notes, arrows, highlights,
    board_order, eval_cp, eval_mate, eval_depth, eval_best_move_uci,
    white_name, black_name, headers, game_analysis, opening_report,
    opening_eco, opening_name, opening_family, created_at, updated_at
  ) values (
    v_user_id, gen_random_uuid(), v_source_board.lesson_id,
    v_source_board.title || ' (copia)', v_source_board.fen,
    v_source_board.notes, v_source_board.arrows, v_source_board.highlights,
    v_board_order, v_source_board.eval_cp, v_source_board.eval_mate,
    v_source_board.eval_depth, v_source_board.eval_best_move_uci,
    v_source_board.white_name, v_source_board.black_name,
    v_source_board.headers, v_source_board.game_analysis,
    v_source_board.opening_report, v_source_board.opening_eco,
    v_source_board.opening_name, v_source_board.opening_family, now(), now()
  )
  returning id into v_board_id;

  for v_source_move in
    select *
    from public.moves
    where board_id = p_source_board_id
      and user_id = v_user_id
    order by move_order, id
  loop
    v_parent_id := case
      when v_source_move.parent_id is null then null
      else (v_move_id_map ->> v_source_move.parent_id::text)::bigint
    end;

    if v_source_move.parent_id is not null and v_parent_id is null then
      raise exception 'Relazione tra mosse non valida.'
        using errcode = '23503';
    end if;

    insert into public.moves (
      user_id, uid, board_id, parent_id, move_notation, fen, move_order,
      comment, analysis_comment, stockfish_comment, arrows, highlights,
      tactics, eval_cp, eval_mate, eval_depth, eval_best_move_uci,
      created_at, updated_at
    ) values (
      v_user_id, gen_random_uuid(), v_board_id, v_parent_id,
      v_source_move.move_notation, v_source_move.fen,
      v_source_move.move_order, v_source_move.comment,
      v_source_move.analysis_comment, v_source_move.stockfish_comment,
      v_source_move.arrows, v_source_move.highlights, v_source_move.tactics,
      v_source_move.eval_cp, v_source_move.eval_mate,
      v_source_move.eval_depth, v_source_move.eval_best_move_uci, now(), now()
    )
    returning id into v_move_id;

    v_move_id_map := v_move_id_map
      || jsonb_build_object(v_source_move.id::text, v_move_id);
  end loop;

  return v_board_id;
end;
$$;

revoke execute on function public.duplicate_study_board(bigint)
from public, anon;
grant execute on function public.duplicate_study_board(bigint)
to authenticated;
