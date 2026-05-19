-- ─────────────────────────────────────────────────────────────────────────────
-- Papyrus by Corello — Supabase Schema
-- Run this in the Supabase SQL editor: https://app.supabase.com → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Documents ─────────────────────────────────────────────────────────────────
-- Mirrors PapyrusDocument in lib/types.ts
-- Chat history and artifacts are stored as JSONB columns for simplicity.
-- Normalize into separate tables when > 10k documents per user.

create table if not exists documents (
  id                 text        primary key,            -- UUID generated client-side
  user_id            uuid        not null references auth.users(id) on delete cascade,

  -- File metadata
  file_name          text        not null,
  file_type          text        not null default '',
  file_size_bytes    bigint      not null default 0,
  storage_path       text,                               -- Supabase Storage path (future)

  -- Extraction
  extracted_text     text        not null default '',
  page_count         integer,
  extraction_method  text        not null default 'pdf_text',
  metadata           jsonb,                              -- ExtractedFields | null
  is_mock_mode       boolean     not null default false,

  -- Rich state
  artifacts          jsonb       not null default '{}',  -- Record<ArtifactType, GeneratedArtifact>
  chat_history       jsonb       not null default '[]',  -- ChatMessage[]
  status             text        not null default 'uploading'
                                 check (status in ('uploading','extracting','analyzing','ready','error')),
  error              text,

  -- Timestamps
  uploaded_at        timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Index for common query pattern (user's docs, newest first)
create index if not exists documents_user_uploaded_idx
  on documents (user_id, uploaded_at desc);

-- ── Job Groups ────────────────────────────────────────────────────────────────
-- Mirrors JobGroup in lib/types.ts

create table if not exists job_groups (
  id           text        primary key,
  user_id      uuid        not null references auth.users(id) on delete cascade,

  job_number   text,
  client       text,
  part_number  text,
  document_ids text[]      not null default '{}',

  created_at   timestamptz not null default now()
);

create index if not exists job_groups_user_idx on job_groups (user_id);

-- ── Supabase Storage bucket ───────────────────────────────────────────────────
-- Run this section separately if you want to store original files.
-- insert into storage.buckets (id, name, public)
-- values ('documents', 'documents', false)
-- on conflict do nothing;

-- ── Row Level Security (RLS) ──────────────────────────────────────────────────
-- Each authenticated user can only access their own rows.

alter table documents  enable row level security;
alter table job_groups enable row level security;

-- Documents: full CRUD for owner only
drop policy if exists "documents_owner_all"  on documents;
create policy "documents_owner_all" on documents
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Job groups: full CRUD for owner only
drop policy if exists "job_groups_owner_all" on job_groups;
create policy "job_groups_owner_all" on job_groups
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists documents_updated_at on documents;
create trigger documents_updated_at
  before update on documents
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. After running this schema:
--   1. Go to Authentication → Providers → Email and enable "Email/Password"
--   2. Under Authentication → Settings, disable "Confirm email" for demo use
--   3. Create your first user: Authentication → Users → Add User
--      Email: papyrus@corello.ai  Password: corello123
-- ─────────────────────────────────────────────────────────────────────────────
