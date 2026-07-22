-- Refuse creation of external identities unless a live invitation already exists.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  staff_email boolean := lower(new.email) like '%@formationentredeux.com';
begin
  if not staff_email and not exists (
    select 1 from audit_invitations
    where lower(email)=lower(new.email)
      and revoked_at is null
      and expires_at>now()
  ) then
    raise exception 'INVITATION_REQUIRED';
  end if;

  insert into profiles(id,email,display_name,is_staff)
  values(new.id,lower(new.email),coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)),staff_email)
  on conflict(id) do update set email=excluded.email,is_staff=excluded.is_staff;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public,anon,authenticated;
