-- Comptes (entreprises et intérimaires). À exécuter dans Supabase > SQL Editor.

create table if not exists public.users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique,
  password_hash  text not null,
  role           text not null check (role in ('ENTREPRISE', 'INTERIMAIRE')),
  raison_sociale text,
  siret          text,
  prenom         text,
  nom            text,
  created_at     timestamptz not null default now()
);

-- Le login cherche par email : la contrainte UNIQUE crée déjà l'index B-tree correspondant.

-- Row Level Security activée, sans aucune policy. Le back utilise la clé service_role,
-- qui contourne le RLS : rien ne change pour lui. En revanche, si la clé anon (celle qu'on
-- trouve dans un front) fuite, elle ne peut ni lire ni écrire cette table :
-- les hashs de mots de passe restent inaccessibles.
alter table public.users enable row level security;
