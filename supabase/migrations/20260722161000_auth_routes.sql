-- Expose only the authentication route allowed for a supplied address.
-- The security-definer function can inspect protected profiles, memberships and invitations
-- without granting anonymous users direct table access.
create or replace function public.auth_access_route(requested_email text)
returns text
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  address text := lower(trim(coalesce(requested_email,'')));
  exact_staff_domain boolean;
begin
  exact_staff_domain := address ~ '^[^@[:space:]]+@formationentredeux[.]com$';

  if exists(select 1 from profiles where lower(email)=address and is_staff) then
    return 'staff_existing';
  end if;

  if exact_staff_domain then
    if exists(select 1 from profiles where lower(email)=address) then
      return 'staff_existing';
    end if;
    return 'staff_new';
  end if;

  if exists(
    select 1
    from profiles p
    join audit_members m on m.user_id=p.id
    where lower(p.email)=address and not p.is_staff
  ) or exists(
    select 1 from audit_invitations
    where lower(email)=address and revoked_at is null and expires_at>now()
  ) then
    return 'viewer';
  end if;

  return 'none';
end;
$$;

revoke all on function public.auth_access_route(text) from public;
grant execute on function public.auth_access_route(text) to anon,authenticated;

-- Keep staff assignment authoritative in the database and require the exact domain.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email,'')));
  staff_email boolean := normalized_email ~ '^[^@[:space:]]+@formationentredeux[.]com$';
begin
  if not staff_email and not exists (
    select 1 from audit_invitations
    where lower(email)=normalized_email
      and revoked_at is null
      and expires_at>now()
  ) then
    raise exception 'INVITATION_REQUIRED';
  end if;

  insert into profiles(id,email,display_name,is_staff)
  values(new.id,normalized_email,coalesce(new.raw_user_meta_data->>'display_name',split_part(normalized_email,'@',1)),staff_email)
  on conflict(id) do update set email=excluded.email,is_staff=excluded.is_staff;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public,anon,authenticated;
