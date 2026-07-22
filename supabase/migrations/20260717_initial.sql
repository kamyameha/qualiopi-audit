-- Formation Entre-Deux — secure, browser-only Supabase backend.
create extension if not exists pgcrypto;

do $$ begin create type public.audit_status as enum ('preparation','revision','termine'); exception when duplicate_object then null; end $$;
do $$ begin create type public.indicator_status as enum ('non_commence','en_cours','termine'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_staff boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
  name text not null, audit_date date, audit_type text not null, responsible_name text,
  status public.audit_status not null default 'preparation', reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.audit_members (
  audit_id uuid not null references public.audits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(audit_id,user_id)
);
create table if not exists public.audit_invitations (
  id uuid primary key default gen_random_uuid(), audit_id uuid not null references public.audits(id) on delete cascade,
  email text not null, invited_by uuid not null references auth.users(id), accepted_by uuid references auth.users(id),
  accepted_at timestamptz, revoked_at timestamptz, expires_at timestamptz not null default now()+interval '14 days',
  created_at timestamptz not null default now(), unique(audit_id,email)
);
create table if not exists public.audit_indicators (
  audit_id uuid not null references public.audits(id) on delete cascade,
  indicator_number integer not null check(indicator_number between 1 and 32),
  status public.indicator_status not null default 'non_commence', notes text not null default '',
  updated_at timestamptz not null default now(), primary key(audit_id,indicator_number)
);
create table if not exists public.evidence_files (
  id uuid primary key default gen_random_uuid(), audit_id uuid not null, indicator_number integer not null,
  storage_path text not null unique, original_name text not null, mime_type text, size_bytes bigint,
  uploaded_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  foreign key(audit_id,indicator_number) references public.audit_indicators(audit_id,indicator_number) on delete cascade
);
create table if not exists public.evidence_links (
  id uuid primary key default gen_random_uuid(), audit_id uuid not null, indicator_number integer not null,
  name text, url text not null check(url ~ '^https?://'), created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(audit_id,indicator_number) references public.audit_indicators(audit_id,indicator_number) on delete cascade
);

create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public
as $$ select coalesce((select is_staff from profiles where id=auth.uid()),false) $$;
create or replace function public.can_view_audit(a uuid) returns boolean language sql stable security definer set search_path=public
as $$ select public.is_staff() or exists(select 1 from audit_members where audit_id=a and user_id=auth.uid()) $$;
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public
as $$ begin
  insert into profiles(id,email,display_name,is_staff) values(new.id,lower(new.email),coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)),lower(new.email) like '%@formationentredeux.com')
  on conflict(id) do update set email=excluded.email,is_staff=excluded.is_staff;
  return new;
end $$;
create or replace function public.handle_new_audit() returns trigger language plpgsql security definer set search_path=public
as $$ begin
  if not public.is_staff() or new.owner_id<>auth.uid() then raise exception 'STAFF_REQUIRED'; end if;
  insert into audit_members(audit_id,user_id) values(new.id,new.owner_id) on conflict do nothing;
  insert into audit_indicators(audit_id,indicator_number) select new.id,n from generate_series(1,32)n;
  return new;
end $$;
create or replace function public.accept_my_invitations() returns integer language plpgsql security definer set search_path=public
as $$ declare n integer; begin
  insert into audit_members(audit_id,user_id)
  select audit_id,auth.uid() from audit_invitations
  where lower(email)=lower(coalesce(auth.jwt()->>'email','')) and revoked_at is null and expires_at>now()
  on conflict do nothing;
  update audit_invitations set accepted_by=auth.uid(),accepted_at=coalesce(accepted_at,now())
  where lower(email)=lower(coalesce(auth.jwt()->>'email','')) and revoked_at is null and expires_at>now();
  get diagnostics n=row_count; return n;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users for each row execute function public.handle_new_user();
drop trigger if exists on_audit_created on public.audits;
create trigger on_audit_created after insert on public.audits for each row execute function public.handle_new_audit();
drop trigger if exists touch_audits on public.audits;
create trigger touch_audits before update on public.audits for each row execute function public.touch_updated_at();
drop trigger if exists touch_indicators on public.audit_indicators;
create trigger touch_indicators before update on public.audit_indicators for each row execute function public.touch_updated_at();

alter table profiles enable row level security; alter table audits enable row level security;
alter table audit_members enable row level security; alter table audit_invitations enable row level security;
alter table audit_indicators enable row level security; alter table evidence_files enable row level security;
alter table evidence_links enable row level security;

do $$ declare r record; begin for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' loop execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename); end loop; end $$;
create policy profiles_read on profiles for select to authenticated using(
  id=auth.uid() or public.is_staff() or exists(select 1 from evidence_files f where f.uploaded_by=profiles.id and public.can_view_audit(f.audit_id))
);
create policy audits_read on audits for select to authenticated using(public.can_view_audit(id));
create policy audits_staff_write on audits for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy members_read on audit_members for select to authenticated using(public.can_view_audit(audit_id));
create policy invitations_staff on audit_invitations for all to authenticated using(public.is_staff()) with check(public.is_staff() and invited_by=auth.uid() and lower(email) not like '%@formationentredeux.com');
create policy indicators_read on audit_indicators for select to authenticated using(public.can_view_audit(audit_id));
create policy indicators_staff_write on audit_indicators for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy files_read on evidence_files for select to authenticated using(public.can_view_audit(audit_id));
create policy files_staff_write on evidence_files for all to authenticated using(public.is_staff()) with check(public.is_staff() and uploaded_by=auth.uid());
create policy links_read on evidence_links for select to authenticated using(public.can_view_audit(audit_id));
create policy links_staff_write on evidence_links for all to authenticated using(public.is_staff()) with check(public.is_staff() and created_by=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit) values('audit-evidence','audit-evidence',false,52428800)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'audit_evidence_%' loop execute format('drop policy if exists %I on storage.objects',r.policyname); end loop; end $$;
create policy audit_evidence_read on storage.objects for select to authenticated using(bucket_id='audit-evidence' and public.can_view_audit(((storage.foldername(name))[1])::uuid));
create policy audit_evidence_insert on storage.objects for insert to authenticated with check(bucket_id='audit-evidence' and public.is_staff());
create policy audit_evidence_update on storage.objects for update to authenticated using(bucket_id='audit-evidence' and public.is_staff()) with check(bucket_id='audit-evidence' and public.is_staff());
create policy audit_evidence_delete on storage.objects for delete to authenticated using(bucket_id='audit-evidence' and public.is_staff());

grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;
grant execute on function public.is_staff(),public.can_view_audit(uuid),public.accept_my_invitations() to authenticated;
revoke all on function public.handle_new_user(),public.handle_new_audit() from public,anon,authenticated;
