-- Comptes (entreprises et intérimaires). Appliqué par `npm run db:migrate`.

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
