revoke all on table
  public.user_settings,
  public.lessons,
  public.boards,
  public.moves
from authenticated;

grant select, insert, update, delete on table
  public.user_settings,
  public.lessons,
  public.boards,
  public.moves
to authenticated;
