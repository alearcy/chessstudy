create or replace function public.convert_analysis_to_study(
  p_source_lesson_id bigint,
  p_source_board_id bigint
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_source_lesson public.lessons%rowtype;
  v_source_board public.boards%rowtype;
  v_source_move public.moves%rowtype;
  v_lesson_id bigint;
  v_board_id bigint;
  v_parent_id bigint := null;
begin
  if v_user_id is null then
    raise exception 'Autenticazione richiesta.' using errcode = '42501';
  end if;

  select * into v_source_lesson
  from public.lessons
  where id = p_source_lesson_id
    and user_id = v_user_id
    and mode = 'analysis';

  select * into v_source_board
  from public.boards
  where id = p_source_board_id
    and lesson_id = p_source_lesson_id
    and user_id = v_user_id;

  if v_source_lesson.id is null or v_source_board.id is null then
    raise exception 'Analisi non disponibile.' using errcode = 'P0002';
  end if;

  insert into public.lessons (
    user_id, uid, title, description, mode, is_favorite, created_at, updated_at
  ) values (
    v_user_id, gen_random_uuid(), v_source_lesson.title || ' (Studio)',
    v_source_lesson.description, 'study', false, now(), now()
  )
  returning id into v_lesson_id;

  insert into public.boards (
    user_id, uid, lesson_id, title, fen, board_order, created_at, updated_at
  ) values (
    v_user_id, gen_random_uuid(), v_lesson_id, v_source_board.title,
    v_source_board.fen, 0, now(), now()
  )
  returning id into v_board_id;

  for v_source_move in
    select *
    from public.moves
    where board_id = p_source_board_id and user_id = v_user_id
    order by move_order, id
  loop
    insert into public.moves (
      user_id, uid, board_id, parent_id, move_notation, fen, move_order,
      created_at, updated_at
    ) values (
      v_user_id, gen_random_uuid(), v_board_id, v_parent_id,
      v_source_move.move_notation, v_source_move.fen, v_source_move.move_order,
      now(), now()
    )
    returning id into v_parent_id;
  end loop;

  return v_lesson_id;
end;
$$;

revoke execute on function public.convert_analysis_to_study(bigint, bigint)
from public, anon;
grant execute on function public.convert_analysis_to_study(bigint, bigint)
to authenticated;
