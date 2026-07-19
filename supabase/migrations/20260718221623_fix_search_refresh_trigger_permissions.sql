create or replace function public.handle_lesson_search_refresh()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lesson_id bigint;
begin
  if tg_table_name = 'lessons' then
    v_lesson_id := new.id;
  elsif tg_op = 'DELETE' then
    v_lesson_id := old.lesson_id;
  else
    if tg_op = 'UPDATE' and old.lesson_id is distinct from new.lesson_id then
      update public.lessons as previous_lesson
      set search_text = lower(concat_ws(
        ' ',
        previous_lesson.title,
        previous_lesson.description,
        (
          select string_agg(
            concat_ws(
              ' ',
              board.title,
              board.white_name,
              board.black_name,
              board.headers::text,
              board.opening_eco,
              board.opening_name,
              board.opening_family
            ),
            ' '
          )
          from public.boards as board
          where board.lesson_id = previous_lesson.id
            and board.user_id = previous_lesson.user_id
        )
      ))
      where previous_lesson.id = old.lesson_id
        and previous_lesson.user_id = (select auth.uid());
    end if;
    v_lesson_id := new.lesson_id;
  end if;

  update public.lessons as lesson
  set search_text = lower(concat_ws(
    ' ',
    lesson.title,
    lesson.description,
    (
      select string_agg(
        concat_ws(
          ' ',
          board.title,
          board.white_name,
          board.black_name,
          board.headers::text,
          board.opening_eco,
          board.opening_name,
          board.opening_family
        ),
        ' '
      )
      from public.boards as board
      where board.lesson_id = lesson.id
        and board.user_id = lesson.user_id
    )
  ))
  where lesson.id = v_lesson_id
    and lesson.user_id = (select auth.uid());

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop function public.refresh_lesson_search_text(bigint);

notify pgrst, 'reload schema';
