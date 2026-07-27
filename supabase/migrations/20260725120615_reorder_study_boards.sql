create or replace function public.reorder_study_boards(
  p_lesson_id bigint,
  p_board_ids bigint[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_requested_count integer;
  v_unique_count integer;
  v_actual_count integer;
  v_matched_count integer;
  v_offset integer;
begin
  if v_user_id is null then
    raise exception 'Autenticazione richiesta.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.lessons l
    where l.id = p_lesson_id
      and l.user_id = v_user_id
      and l.mode = 'study'
  ) then
    raise exception 'Studio non disponibile.' using errcode = 'P0002';
  end if;

  select
    count(*)::integer,
    count(distinct requested.board_id)::integer
  into v_requested_count, v_unique_count
  from unnest(p_board_ids) as requested(board_id);

  if v_requested_count = 0 then
    raise exception 'Ordine scacchiere vuoto.' using errcode = '22023';
  end if;

  if v_requested_count <> v_unique_count
    or v_requested_count <> array_length(p_board_ids, 1)
  then
    raise exception 'Scacchiere duplicate nell''ordine richiesto.'
      using errcode = '22023';
  end if;

  perform 1
  from public.boards b
  where b.lesson_id = p_lesson_id
    and b.user_id = v_user_id
  order by b.id
  for update;

  select
    count(*)::integer,
    coalesce(max(b.board_order), -1) + count(*)::integer + 1
  into v_actual_count, v_offset
  from public.boards b
  where b.lesson_id = p_lesson_id
    and b.user_id = v_user_id;

  select count(*)::integer
  into v_matched_count
  from public.boards b
  join unnest(p_board_ids) as requested(board_id)
    on requested.board_id = b.id
  where b.lesson_id = p_lesson_id
    and b.user_id = v_user_id;

  if v_requested_count <> v_actual_count
    or v_matched_count <> v_actual_count
  then
    raise exception 'L''ordine deve includere tutte le scacchiere.'
      using errcode = '22023';
  end if;

  update public.boards
  set board_order = board_order + v_offset,
      updated_at = now()
  where lesson_id = p_lesson_id
    and user_id = v_user_id;

  update public.boards b
  set board_order = (requested.ordinality - 1)::integer,
      updated_at = now()
  from unnest(p_board_ids) with ordinality
    as requested(board_id, ordinality)
  where b.id = requested.board_id
    and b.lesson_id = p_lesson_id
    and b.user_id = v_user_id;
end;
$$;

revoke execute on function public.reorder_study_boards(bigint, bigint[])
from public, anon;
grant execute on function public.reorder_study_boards(bigint, bigint[])
to authenticated;
