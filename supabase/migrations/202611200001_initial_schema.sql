-- CODEFORGE initial schema. Supabase Auth is the identity source of truth.
-- Never place a service_role / secret key in the web app or Android APK.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My workspace',
  slug text not null default 'my-workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  name text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (project_id, path)
);

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists project_files_project_id_idx on public.project_files(project_id);
create index if not exists project_files_user_id_idx on public.project_files(user_id);

alter table public.projects enable row level security;
alter table public.project_files enable row level security;

revoke all on table public.projects from anon, authenticated;
revoke all on table public.project_files from anon, authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.project_files to authenticated;

create policy "Users manage their own projects"
on public.projects
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own project files"
on public.project_files
for all to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.projects p
    where p.id = project_files.project_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.projects p
    where p.id = project_files.project_id
      and p.user_id = (select auth.uid())
  )
);
