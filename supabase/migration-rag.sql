-- À lancer dans Supabase > SQL Editor.
-- Prérequis : activer l'extension pgvector dans Supabase > Database > Extensions.

create extension if not exists vector;

-- Table des documents indexés
create table if not exists public.documents (
  id          uuid    primary key default gen_random_uuid(),
  title       text    not null,
  filename    text    not null unique,
  chunk_count integer not null default 0,
  indexed_at  timestamptz not null default now()
);

-- Table des blocs de texte avec leurs vecteurs
create table if not exists public.document_chunks (
  id          uuid    primary key default gen_random_uuid(),
  document_id uuid    not null references public.documents(id) on delete cascade,
  content     text    not null,
  embedding   vector(1536),
  chunk_index integer not null,
  indexed_at  timestamptz not null default now()
);

-- Index HNSW pour la recherche de similarité (rapide sur de grands volumes)
create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- Accès en lecture pour les enseignants connectés
alter table public.documents       enable row level security;
alter table public.document_chunks enable row level security;

drop policy if exists "Authenticated users can read documents"       on public.documents;
drop policy if exists "Authenticated users can read document chunks" on public.document_chunks;

create policy "Authenticated users can read documents"
  on public.documents for select
  to authenticated
  using (true);

create policy "Authenticated users can read document chunks"
  on public.document_chunks for select
  to authenticated
  using (true);

-- Fonction de recherche sémantique par similarité cosinus
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count     int   default 6,
  match_threshold float default 0.45
)
returns table (
  id          uuid,
  document_id uuid,
  content     text,
  similarity  float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
