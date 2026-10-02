alter policy profiles_select_self_or_shared_guild
on public.profiles
using (
  id = (select auth.uid())
  or private.shares_active_guild(id)
);

alter policy profiles_update_self
on public.profiles
using (id = (select auth.uid()))
with check (id = (select auth.uid()));
