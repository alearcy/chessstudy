create or replace function public.refresh_lesson_search_text(
  p_lesson_id bigint
)
returns void
language sql
security invoker
set search_path = ''
as $$
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
  where lesson.id = p_lesson_id
    and lesson.user_id = (select auth.uid());
$$;

create or replace function public.handle_lesson_search_refresh()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'lessons' then
    perform public.refresh_lesson_search_text(new.id);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.refresh_lesson_search_text(old.lesson_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.lesson_id <> new.lesson_id then
    perform public.refresh_lesson_search_text(old.lesson_id);
  end if;
  perform public.refresh_lesson_search_text(new.lesson_id);
  return new;
end;
$$;

create trigger lessons_refresh_search_text
after insert or update of title, description on public.lessons
for each row execute function public.handle_lesson_search_refresh();

create trigger boards_refresh_lesson_search_text
after insert or update of title, white_name, black_name, headers, opening_eco,
  opening_name, opening_family, lesson_id or delete on public.boards
for each row execute function public.handle_lesson_search_refresh();

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
  v_user_id uuid := (select auth.uid());
  v_lesson_id bigint;
  v_board_id bigint;
  v_parent_id bigint := null;
  v_move jsonb;
begin
  if v_user_id is null then
    raise exception 'Autenticazione richiesta.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lesson) <> 'object'
     or jsonb_typeof(p_board) <> 'object'
     or jsonb_typeof(coalesce(p_moves, '[]'::jsonb)) <> 'array' then
    raise exception 'Payload non valido.' using errcode = '22023';
  end if;

  if p_lesson_id is null then
    insert into public.lessons (
      user_id, uid, title, description, mode, is_favorite, created_at, updated_at
    ) values (
      v_user_id,
      coalesce((p_lesson ->> 'uid')::uuid, gen_random_uuid()),
      p_lesson ->> 'title',
      coalesce(p_lesson ->> 'description', ''),
      coalesce(p_lesson ->> 'mode', 'study'),
      coalesce((p_lesson ->> 'is_favorite')::boolean, false),
      coalesce((p_lesson ->> 'created_at')::timestamptz, now()),
      coalesce((p_lesson ->> 'updated_at')::timestamptz, now())
    )
    returning id into v_lesson_id;
  else
    select id into v_lesson_id
    from public.lessons
    where id = p_lesson_id and user_id = v_user_id
    for update;
    if v_lesson_id is null then
      raise exception 'Lezione non disponibile.' using errcode = 'P0002';
    end if;
    if not p_replace then
      raise exception 'La sostituzione deve essere confermata.' using errcode = '22023';
    end if;

    delete from public.boards
    where lesson_id = v_lesson_id and user_id = v_user_id;
    update public.lessons
    set title = p_lesson ->> 'title',
        description = coalesce(p_lesson ->> 'description', description),
        mode = coalesce(p_lesson ->> 'mode', mode),
        is_favorite = coalesce((p_lesson ->> 'is_favorite')::boolean, is_favorite),
        updated_at = now()
    where id = v_lesson_id and user_id = v_user_id;
  end if;

  insert into public.boards (
    user_id, uid, lesson_id, title, fen, notes, arrows, highlights, board_order,
    eval_cp, eval_mate, eval_depth, eval_best_move_uci, white_name, black_name,
    headers, game_analysis, opening_report, opening_eco, opening_name,
    opening_family, created_at, updated_at
  ) values (
    v_user_id,
    coalesce((p_board ->> 'uid')::uuid, gen_random_uuid()),
    v_lesson_id,
    p_board ->> 'title',
    p_board ->> 'fen',
    coalesce(p_board ->> 'notes', ''),
    coalesce(p_board -> 'arrows', '[]'::jsonb),
    coalesce(p_board -> 'highlights', '[]'::jsonb),
    0,
    (p_board ->> 'eval_cp')::integer,
    (p_board ->> 'eval_mate')::integer,
    coalesce((p_board ->> 'eval_depth')::smallint, 0),
    p_board ->> 'eval_best_move_uci',
    p_board ->> 'white_name',
    p_board ->> 'black_name',
    coalesce(p_board -> 'headers', '{}'::jsonb),
    p_board ->> 'game_analysis',
    nullif(p_board -> 'opening_report', 'null'::jsonb),
    p_board ->> 'opening_eco',
    p_board ->> 'opening_name',
    p_board ->> 'opening_family',
    coalesce((p_board ->> 'created_at')::timestamptz, now()),
    coalesce((p_board ->> 'updated_at')::timestamptz, now())
  )
  returning id into v_board_id;

  for v_move in
    select value
    from jsonb_array_elements(coalesce(p_moves, '[]'::jsonb))
    order by (value ->> 'move_order')::integer
  loop
    insert into public.moves (
      user_id, uid, board_id, parent_id, move_notation, fen, move_order,
      comment, analysis_comment, stockfish_comment, arrows, highlights,
      eval_cp, eval_mate, eval_depth, eval_best_move_uci, created_at, updated_at
    ) values (
      v_user_id,
      coalesce((v_move ->> 'uid')::uuid, gen_random_uuid()),
      v_board_id,
      v_parent_id,
      v_move ->> 'move_notation',
      v_move ->> 'fen',
      (v_move ->> 'move_order')::integer,
      coalesce(v_move ->> 'comment', ''),
      v_move ->> 'analysis_comment',
      v_move ->> 'stockfish_comment',
      coalesce(v_move -> 'arrows', '[]'::jsonb),
      coalesce(v_move -> 'highlights', '[]'::jsonb),
      (v_move ->> 'eval_cp')::integer,
      (v_move ->> 'eval_mate')::integer,
      coalesce((v_move ->> 'eval_depth')::smallint, 0),
      v_move ->> 'eval_best_move_uci',
      coalesce((v_move ->> 'created_at')::timestamptz, now()),
      coalesce((v_move ->> 'updated_at')::timestamptz, now())
    )
    returning id into v_parent_id;
  end loop;

  return jsonb_build_object('lesson_id', v_lesson_id, 'board_id', v_board_id);
end;
$$;

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
  v_user_id uuid := (select auth.uid());
  v_board_id bigint;
  v_board_order integer;
  v_parent_id bigint := null;
  v_move jsonb;
begin
  if v_user_id is null then
    raise exception 'Autenticazione richiesta.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.lessons
    where id = p_lesson_id and user_id = v_user_id
  ) then
    raise exception 'Lezione non disponibile.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_board) <> 'object'
     or jsonb_typeof(coalesce(p_moves, '[]'::jsonb)) <> 'array' then
    raise exception 'Payload non valido.' using errcode = '22023';
  end if;

  if p_board_id is null then
    select coalesce(max(board_order) + 1, 0)
    into v_board_order
    from public.boards
    where lesson_id = p_lesson_id and user_id = v_user_id;

    insert into public.boards (
      user_id, uid, lesson_id, title, fen, notes, arrows, highlights, board_order,
      eval_cp, eval_mate, eval_depth, eval_best_move_uci, white_name, black_name,
      headers, game_analysis, opening_report, opening_eco, opening_name,
      opening_family, created_at, updated_at
    ) values (
      v_user_id,
      coalesce((p_board ->> 'uid')::uuid, gen_random_uuid()),
      p_lesson_id,
      p_board ->> 'title',
      p_board ->> 'fen',
      coalesce(p_board ->> 'notes', ''),
      coalesce(p_board -> 'arrows', '[]'::jsonb),
      coalesce(p_board -> 'highlights', '[]'::jsonb),
      v_board_order,
      (p_board ->> 'eval_cp')::integer,
      (p_board ->> 'eval_mate')::integer,
      coalesce((p_board ->> 'eval_depth')::smallint, 0),
      p_board ->> 'eval_best_move_uci',
      p_board ->> 'white_name',
      p_board ->> 'black_name',
      coalesce(p_board -> 'headers', '{}'::jsonb),
      p_board ->> 'game_analysis',
      nullif(p_board -> 'opening_report', 'null'::jsonb),
      p_board ->> 'opening_eco',
      p_board ->> 'opening_name',
      p_board ->> 'opening_family',
      coalesce((p_board ->> 'created_at')::timestamptz, now()),
      coalesce((p_board ->> 'updated_at')::timestamptz, now())
    )
    returning id into v_board_id;
  else
    select id, board_order into v_board_id, v_board_order
    from public.boards
    where id = p_board_id
      and lesson_id = p_lesson_id
      and user_id = v_user_id
    for update;
    if v_board_id is null then
      raise exception 'Scacchiera non disponibile.' using errcode = 'P0002';
    end if;

    delete from public.moves
    where board_id = v_board_id and user_id = v_user_id;
    update public.boards
    set title = p_board ->> 'title',
        fen = p_board ->> 'fen',
        notes = coalesce(p_board ->> 'notes', ''),
        arrows = coalesce(p_board -> 'arrows', '[]'::jsonb),
        highlights = coalesce(p_board -> 'highlights', '[]'::jsonb),
        eval_cp = (p_board ->> 'eval_cp')::integer,
        eval_mate = (p_board ->> 'eval_mate')::integer,
        eval_depth = coalesce((p_board ->> 'eval_depth')::smallint, 0),
        eval_best_move_uci = p_board ->> 'eval_best_move_uci',
        white_name = p_board ->> 'white_name',
        black_name = p_board ->> 'black_name',
        headers = coalesce(p_board -> 'headers', '{}'::jsonb),
        game_analysis = p_board ->> 'game_analysis',
        opening_report = nullif(p_board -> 'opening_report', 'null'::jsonb),
        opening_eco = p_board ->> 'opening_eco',
        opening_name = p_board ->> 'opening_name',
        opening_family = p_board ->> 'opening_family',
        updated_at = now()
    where id = v_board_id and user_id = v_user_id;
  end if;

  for v_move in
    select value
    from jsonb_array_elements(coalesce(p_moves, '[]'::jsonb))
    order by (value ->> 'move_order')::integer
  loop
    insert into public.moves (
      user_id, uid, board_id, parent_id, move_notation, fen, move_order,
      comment, analysis_comment, stockfish_comment, arrows, highlights,
      eval_cp, eval_mate, eval_depth, eval_best_move_uci, created_at, updated_at
    ) values (
      v_user_id,
      coalesce((v_move ->> 'uid')::uuid, gen_random_uuid()),
      v_board_id,
      v_parent_id,
      v_move ->> 'move_notation',
      v_move ->> 'fen',
      (v_move ->> 'move_order')::integer,
      coalesce(v_move ->> 'comment', ''),
      v_move ->> 'analysis_comment',
      v_move ->> 'stockfish_comment',
      coalesce(v_move -> 'arrows', '[]'::jsonb),
      coalesce(v_move -> 'highlights', '[]'::jsonb),
      (v_move ->> 'eval_cp')::integer,
      (v_move ->> 'eval_mate')::integer,
      coalesce((v_move ->> 'eval_depth')::smallint, 0),
      v_move ->> 'eval_best_move_uci',
      coalesce((v_move ->> 'created_at')::timestamptz, now()),
      coalesce((v_move ->> 'updated_at')::timestamptz, now())
    )
    returning id into v_parent_id;
  end loop;

  return jsonb_build_object('lesson_id', p_lesson_id, 'board_id', v_board_id);
end;
$$;

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
  select * into v_source_lesson
  from public.lessons
  where id = p_source_lesson_id and user_id = v_user_id;
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
    user_id, uid, lesson_id, title, fen, notes, arrows, highlights, board_order,
    eval_cp, eval_mate, eval_depth, eval_best_move_uci, white_name, black_name,
    headers, game_analysis, opening_report, opening_eco, opening_name,
    opening_family, created_at, updated_at
  ) values (
    v_user_id, gen_random_uuid(), v_lesson_id, v_source_board.title,
    v_source_board.fen, v_source_board.notes, v_source_board.arrows,
    v_source_board.highlights, 0, v_source_board.eval_cp,
    v_source_board.eval_mate, v_source_board.eval_depth,
    v_source_board.eval_best_move_uci, v_source_board.white_name,
    v_source_board.black_name, v_source_board.headers,
    v_source_board.game_analysis, v_source_board.opening_report,
    v_source_board.opening_eco, v_source_board.opening_name,
    v_source_board.opening_family, now(), now()
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
      comment, analysis_comment, stockfish_comment, arrows, highlights,
      eval_cp, eval_mate, eval_depth, eval_best_move_uci, created_at, updated_at
    ) values (
      v_user_id, gen_random_uuid(), v_board_id, v_parent_id,
      v_source_move.move_notation, v_source_move.fen, v_source_move.move_order,
      v_source_move.comment, v_source_move.analysis_comment,
      v_source_move.stockfish_comment, v_source_move.arrows,
      v_source_move.highlights, v_source_move.eval_cp, v_source_move.eval_mate,
      v_source_move.eval_depth, v_source_move.eval_best_move_uci, now(), now()
    )
    returning id into v_parent_id;
  end loop;

  return v_lesson_id;
end;
$$;

create or replace function public.import_database_backup_v1(
  p_backup jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_lesson_map jsonb := '{}'::jsonb;
  v_lesson jsonb;
  v_board jsonb;
  v_move jsonb;
  v_old_lesson_id text;
  v_old_board_id text;
  v_lesson_id bigint;
  v_board_id bigint;
  v_parent_id bigint;
  v_lessons_count integer;
  v_boards_count integer;
  v_moves_count integer;
  v_profiles_count integer;
begin
  if v_user_id is null then
    raise exception 'Autenticazione richiesta.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_backup) is distinct from 'object'
     or p_backup ->> 'format' is distinct from 'chessstudy-backup'
     or (p_backup ->> 'version') is distinct from '1'
     or jsonb_typeof(p_backup #> '{data,profiles}') is distinct from 'array'
     or jsonb_typeof(p_backup #> '{data,lessons}') is distinct from 'array'
     or jsonb_typeof(p_backup #> '{data,boards}') is distinct from 'array'
     or jsonb_typeof(p_backup #> '{data,moves}') is distinct from 'array' then
    raise exception 'Formato o versione del backup non supportati.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_backup #> '{data,boards}') as incoming_board
    where not exists (
      select 1
      from jsonb_array_elements(p_backup #> '{data,lessons}') as incoming_lesson
      where incoming_lesson ->> 'id' = incoming_board ->> 'lessonId'
    )
  ) then
    raise exception 'Il backup contiene una scacchiera orfana.'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_backup #> '{data,moves}') as incoming_move
    where not exists (
      select 1
      from jsonb_array_elements(p_backup #> '{data,boards}') as incoming_board
      where incoming_board ->> 'id' = incoming_move ->> 'boardId'
    )
  ) then
    raise exception 'Il backup contiene una mossa orfana.'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.lessons as existing
    join jsonb_array_elements(p_backup #> '{data,lessons}') as incoming
      on existing.uid = (incoming ->> 'uid')::uuid
    where existing.user_id = v_user_id
  ) or exists (
    select 1
    from public.boards as existing
    join jsonb_array_elements(p_backup #> '{data,boards}') as incoming
      on existing.uid = (incoming ->> 'uid')::uuid
    where existing.user_id = v_user_id
  ) or exists (
    select 1
    from public.moves as existing
    join jsonb_array_elements(p_backup #> '{data,moves}') as incoming
      on existing.uid = (incoming ->> 'uid')::uuid
    where existing.user_id = v_user_id
  ) then
    raise exception 'Il backup contiene contenuti già presenti.'
      using errcode = '23505';
  end if;

  for v_lesson in
    select value
    from jsonb_array_elements(p_backup #> '{data,lessons}')
    order by (value ->> 'id')::bigint
  loop
    v_old_lesson_id := v_lesson ->> 'id';
    insert into public.lessons (
      user_id, uid, title, description, mode, is_favorite, created_at, updated_at
    ) values (
      v_user_id,
      (v_lesson ->> 'uid')::uuid,
      v_lesson ->> 'title',
      coalesce(v_lesson ->> 'description', ''),
      v_lesson ->> 'mode',
      coalesce((v_lesson ->> 'isFavorite')::boolean, false),
      (v_lesson ->> 'createdAt')::timestamptz,
      coalesce((v_lesson ->> 'updatedAt')::timestamptz,
               (v_lesson ->> 'createdAt')::timestamptz)
    )
    returning id into v_lesson_id;
    v_lesson_map := v_lesson_map ||
      jsonb_build_object(v_old_lesson_id, v_lesson_id);
  end loop;

  for v_board in
    select value
    from jsonb_array_elements(p_backup #> '{data,boards}')
    order by (value ->> 'lessonId')::bigint, (value ->> 'order')::integer
  loop
    v_old_board_id := v_board ->> 'id';
    v_old_lesson_id := v_board ->> 'lessonId';
    if not (v_lesson_map ? v_old_lesson_id) then
      raise exception 'Il backup contiene una scacchiera orfana.'
        using errcode = '23503';
    end if;
    v_lesson_id := (v_lesson_map ->> v_old_lesson_id)::bigint;

    insert into public.boards (
      user_id, uid, lesson_id, title, fen, notes, arrows, highlights,
      board_order, eval_cp, eval_mate, eval_depth, eval_best_move_uci,
      white_name, black_name, headers, game_analysis, opening_report,
      opening_eco, opening_name, opening_family, created_at, updated_at
    ) values (
      v_user_id,
      (v_board ->> 'uid')::uuid,
      v_lesson_id,
      v_board ->> 'title',
      v_board ->> 'fen',
      coalesce(v_board ->> 'notes', ''),
      coalesce(v_board -> 'arrows', '[]'::jsonb),
      coalesce(v_board -> 'highlights', '[]'::jsonb),
      (v_board ->> 'order')::integer,
      (v_board ->> 'evalCp')::integer,
      (v_board ->> 'evalMate')::integer,
      coalesce((v_board ->> 'evalDepth')::smallint, 0),
      v_board ->> 'evalBestMoveUci',
      v_board ->> 'whiteName',
      v_board ->> 'blackName',
      coalesce(v_board -> 'headers', '{}'::jsonb),
      v_board ->> 'gameAnalysis',
      nullif(v_board -> 'openingReport', 'null'::jsonb),
      v_board ->> 'openingEco',
      v_board ->> 'openingName',
      v_board ->> 'openingFamily',
      (v_board ->> 'createdAt')::timestamptz,
      coalesce((v_board ->> 'updatedAt')::timestamptz,
               (v_board ->> 'createdAt')::timestamptz)
    )
    returning id into v_board_id;

    v_parent_id := null;
    for v_move in
      select value
      from jsonb_array_elements(p_backup #> '{data,moves}')
      where value ->> 'boardId' = v_old_board_id
      order by (value ->> 'order')::integer, (value ->> 'id')::bigint
    loop
      insert into public.moves (
        user_id, uid, board_id, parent_id, move_notation, fen, move_order,
        comment, analysis_comment, stockfish_comment, arrows, highlights,
        eval_cp, eval_mate, eval_depth, eval_best_move_uci, created_at, updated_at
      ) values (
        v_user_id,
        (v_move ->> 'uid')::uuid,
        v_board_id,
        v_parent_id,
        v_move ->> 'moveNotation',
        v_move ->> 'fen',
        (v_move ->> 'order')::integer,
        coalesce(v_move ->> 'comment', ''),
        v_move ->> 'analysisComment',
        v_move ->> 'stockfishComment',
        coalesce(v_move -> 'arrows', '[]'::jsonb),
        coalesce(v_move -> 'highlights', '[]'::jsonb),
        (v_move ->> 'evalCp')::integer,
        (v_move ->> 'evalMate')::integer,
        coalesce((v_move ->> 'evalDepth')::smallint, 0),
        v_move ->> 'evalBestMoveUci',
        (v_move ->> 'createdAt')::timestamptz,
        coalesce((v_move ->> 'updatedAt')::timestamptz,
                 (v_move ->> 'createdAt')::timestamptz)
      )
      returning id into v_parent_id;
    end loop;
  end loop;

  v_profiles_count := jsonb_array_length(p_backup #> '{data,profiles}');
  v_lessons_count := jsonb_array_length(p_backup #> '{data,lessons}');
  v_boards_count := jsonb_array_length(p_backup #> '{data,boards}');
  v_moves_count := jsonb_array_length(p_backup #> '{data,moves}');
  return jsonb_build_object(
    'profiles', v_profiles_count,
    'lessons', v_lessons_count,
    'boards', v_boards_count,
    'moves', v_moves_count
  );
end;
$$;

revoke execute on function public.refresh_lesson_search_text(bigint)
  from public, anon, authenticated;
revoke execute on function public.handle_lesson_search_refresh()
  from public, anon, authenticated;

revoke execute on function public.save_lesson_tree(bigint, jsonb, jsonb, jsonb, boolean)
  from public, anon;
grant execute on function public.save_lesson_tree(bigint, jsonb, jsonb, jsonb, boolean)
  to authenticated;

revoke execute on function public.save_board_line(bigint, bigint, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_board_line(bigint, bigint, jsonb, jsonb)
  to authenticated;

revoke execute on function public.convert_analysis_to_study(bigint, bigint)
  from public, anon;
grant execute on function public.convert_analysis_to_study(bigint, bigint)
  to authenticated;

revoke execute on function public.import_database_backup_v1(jsonb)
  from public, anon;
grant execute on function public.import_database_backup_v1(jsonb)
  to authenticated;

notify pgrst, 'reload schema';
