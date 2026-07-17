-- Formation Entre-Deux — Qualiopi audit backend
-- Run in the Supabase SQL editor or with the Supabase CLI.

create extension if not exists pgcrypto;

create type public.audit_role as enum ('owner', 'editor', 'viewer');
create type public.audit_status as enum ('preparation', 'revision', 'termine');
create type public.indicator_status as enum ('non_commence', 'en_cours', 'termine');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  audit_date date,
  audit_type text not null,
  responsible_name text,
  status public.audit_status not null default 'preparation',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_members (
  audit_id uuid not null references public.audits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.audit_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (audit_id, user_id)
);

create table public.audit_invitations (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits(id) on delete cascade,
  email text not null,
  role public.audit_role not null default 'viewer',
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.audit_indicators (
  audit_id uuid not null references public.audits(id) on delete cascade,
  indicator_number integer not null check (indicator_number between 1 and 32),
  status public.indicator_status not null default 'non_commence',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  primary key (audit_id, indicator_number)
);

create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits(id) on delete cascade,
  indicator_number integer not null,
  storage_path text not null unique,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (audit_id, indicator_number)
    references public.audit_indicators(audit_id, indicator_number)
    on delete cascade
);

create table public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits(id) on delete cascade,
  indicator_number integer not null,
  name text,
  url text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (audit_id, indicator_number)
    references public.audit_indicators(audit_id, indicator_number)
    on delete cascade
);

create or replace function public.is_audit_member(target_audit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.audit_members
    where audit_id = target_audit_id and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_audit(target_audit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.audit_members
    where audit_id = target_audit_id
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

create or replace function public.handle_new_audit_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_members (audit_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger add_audit_owner_membership
after insert on public.audits
for each row execute function public.handle_new_audit_owner();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_audits before update on public.audits
for each row execute function public.touch_updated_at();
create trigger touch_audit_indicators before update on public.audit_indicators
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.audits enable row level security;
alter table public.audit_members enable row level security;
alter table public.audit_invitations enable row level security;
alter table public.audit_indicators enable row level security;
alter table public.evidence_files enable row level security;
alter table public.evidence_links enable row level security;

create policy "Read own profile" on public.profiles
for select to authenticated using (id = auth.uid());
create policy "Update own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Members can read audits" on public.audits
for select to authenticated using (public.is_audit_member(id));
create policy "Authenticated users create their audits" on public.audits
for insert to authenticated with check (owner_id = auth.uid());
create policy "Editors update audits" on public.audits
for update to authenticated using (public.can_edit_audit(id)) with check (public.can_edit_audit(id));
create policy "Owners delete audits" on public.audits
for delete to authenticated using (
  exists (select 1 from public.audit_members m where m.audit_id = id and m.user_id = auth.uid() and m.role = 'owner')
);

create policy "Members read memberships" on public.audit_members
for select to authenticated using (public.is_audit_member(audit_id));
create policy "Owners manage memberships" on public.audit_members
for all to authenticated
using (exists (select 1 from public.audit_members m where m.audit_id = audit_members.audit_id and m.user_id = auth.uid() and m.role = 'owner'))
with check (exists (select 1 from public.audit_members m where m.audit_id = audit_members.audit_id and m.user_id = auth.uid() and m.role = 'owner'));

create policy "Owners read invitations" on public.audit_invitations
for select to authenticated using (public.can_edit_audit(audit_id));
create policy "Owners create invitations" on public.audit_invitations
for insert to authenticated with check (public.can_edit_audit(audit_id) and invited_by = auth.uid());
create policy "Owners revoke invitations" on public.audit_invitations
for delete to authenticated using (public.can_edit_audit(audit_id));

create policy "Members read indicators" on public.audit_indicators
for select to authenticated using (public.is_audit_member(audit_id));
create policy "Editors create indicators" on public.audit_indicators
for insert to authenticated with check (public.can_edit_audit(audit_id));
create policy "Editors update indicators" on public.audit_indicators
for update to authenticated using (public.can_edit_audit(audit_id)) with check (public.can_edit_audit(audit_id));
create policy "Editors delete indicators" on public.audit_indicators
for delete to authenticated using (public.can_edit_audit(audit_id));

create policy "Members read file metadata" on public.evidence_files
for select to authenticated using (public.is_audit_member(audit_id));
create policy "Editors create file metadata" on public.evidence_files
for insert to authenticated with check (public.can_edit_audit(audit_id) and uploaded_by = auth.uid());
create policy "Editors delete file metadata" on public.evidence_files
for delete to authenticated using (public.can_edit_audit(audit_id));

create policy "Members read links" on public.evidence_links
for select to authenticated using (public.is_audit_member(audit_id));
create policy "Editors create links" on public.evidence_links
for insert to authenticated with check (public.can_edit_audit(audit_id) and created_by = auth.uid());
create policy "Editors update links" on public.evidence_links
for update to authenticated using (public.can_edit_audit(audit_id)) with check (public.can_edit_audit(audit_id));
create policy "Editors delete links" on public.evidence_links
for delete to authenticated using (public.can_edit_audit(audit_id));

-- Private Storage bucket for evidence.
insert into storage.buckets (id, name, public)
values ('audit-evidence', 'audit-evidence', false)
on conflict (id) do nothing;

-- Object paths must start with the audit UUID: <audit_id>/<indicator>/<uuid>-<filename>
create policy "Members download audit evidence" on storage.objects
for select to authenticated
using (
  bucket_id = 'audit-evidence'
  and public.is_audit_member(((storage.foldername(name))[1])::uuid)
);

create policy "Editors upload audit evidence" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'audit-evidence'
  and public.can_edit_audit(((storage.foldername(name))[1])::uuid)
);

create policy "Editors update audit evidence" on storage.objects
for update to authenticated
using (
  bucket_id = 'audit-evidence'
  and public.can_edit_audit(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'audit-evidence'
  and public.can_edit_audit(((storage.foldername(name))[1])::uuid)
);

create policy "Editors delete audit evidence" on storage.objects
for delete to authenticated
using (
  bucket_id = 'audit-evidence'
  and public.can_edit_audit(((storage.foldername(name))[1])::uuid)
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_audit_member(uuid) to authenticated;
grant execute on function public.can_edit_audit(uuid) to authenticated;
