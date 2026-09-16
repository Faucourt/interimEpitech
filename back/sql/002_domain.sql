-- Schéma métier CleanMatch : rôles, profils, missions, candidatures, communes.

-- 1. Utilisateurs : ajout du rôle ADMIN et de la gestion des comptes entreprise.
alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('ENTREPRISE', 'INTERIMAIRE', 'ADMIN'));

alter table public.users add column if not exists telephone text;
-- Compte désactivable par l'admin sans suppression des données.
alter table public.users add column if not exists is_active boolean not null default true;
-- Les comptes entreprise sont créés par l'admin avec un mot de passe temporaire
-- que l'entreprise doit changer à sa première connexion.
alter table public.users add column if not exists must_change_password boolean not null default false;
alter table public.users add column if not exists updated_at timestamptz not null default now();

-- 2. Profil de l'agent intérimaire : matière première du matching.
create table if not exists public.interimaire_profiles (
  user_id           uuid primary key references public.users(id) on delete cascade,
  competences       text[] not null default '{}',
  types_nettoyage   text[] not null default '{}',
  code_postal       text,
  ville             text,
  rayon_km          integer not null default 15 check (rayon_km between 1 and 200),
  -- LUNDI..DIMANCHE
  jours_disponibles text[] not null default '{}',
  -- MATIN, JOURNEE, SOIREE, NUIT, WEEKEND : les horaires décalés sont la norme du secteur.
  creneaux          text[] not null default '{}',
  disponible        boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 3. Dernières missions de l'agent : 25 pts du score.
-- Saisies par l'agent, puis alimentées automatiquement par les missions terminées.
create table if not exists public.experiences (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  intitule        text not null,
  type_nettoyage  text,
  entreprise      text,
  ville           text,
  date_debut      date,
  date_fin        date,
  source          text not null default 'DECLAREE' check (source in ('DECLAREE', 'PLATEFORME')),
  created_at      timestamptz not null default now()
);
create index if not exists experiences_user_idx on public.experiences (user_id, date_fin desc);

-- 4. Missions publiées par les entreprises.
create table if not exists public.missions (
  id                   uuid primary key default gen_random_uuid(),
  entreprise_id        uuid not null references public.users(id) on delete cascade,
  intitule             text not null,
  type_nettoyage       text not null,
  description          text,
  -- Mentions obligatoires d'un contrat de mission (Code du travail).
  motif                text not null,
  date_debut           date not null,
  date_fin             date not null,
  heure_debut          time,
  heure_fin            time,
  jours                text[] not null default '{}',
  creneau              text,
  adresse              text,
  code_postal          text not null,
  ville                text not null,
  competences_requises text[] not null default '{}',
  remuneration         numeric(10, 2),
  nb_agents            integer not null default 1 check (nb_agents >= 1),
  statut               text not null default 'OUVERTE'
                         check (statut in ('OUVERTE', 'POURVUE', 'TERMINEE')),
  justificatif_suppression text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Durée maximale d'une mission d'intérim, renouvellement inclus.
  constraint missions_duree_legale check (
    date_fin >= date_debut and date_fin <= date_debut + interval '18 months'
  )
);
create index if not exists missions_statut_idx on public.missions (statut, date_debut);
create index if not exists missions_entreprise_idx on public.missions (entreprise_id);
create index if not exists missions_cp_idx on public.missions (code_postal);

-- 5. Candidatures.
create table if not exists public.candidatures (
  id                 uuid primary key default gen_random_uuid(),
  mission_id         uuid not null references public.missions(id) on delete cascade,
  interimaire_id     uuid not null references public.users(id) on delete cascade,
  statut             text not null default 'EN_ATTENTE'
                       check (statut in ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE')),
  -- Score figé au moment de la candidature, pour l'historique.
  score              integer check (score between 0 and 100),
  justificatif_refus text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Un agent ne candidate qu'une fois par mission.
  unique (mission_id, interimaire_id)
);
create index if not exists candidatures_mission_idx on public.candidatures (mission_id);
create index if not exists candidatures_interimaire_idx on public.candidatures (interimaire_id);

-- 6. Communes : données publiques (codes postaux data.gouv.fr), servent au calcul
-- de distance du critère localisation (25 pts).
create table if not exists public.communes (
  code_postal text not null,
  nom         text not null,
  latitude    double precision not null,
  longitude   double precision not null,
  primary key (code_postal, nom)
);
create index if not exists communes_cp_idx on public.communes (code_postal);

-- 7. RLS activée partout, sans policy : seul le back (clé secrète) accède aux données.
alter table public.interimaire_profiles enable row level security;
alter table public.experiences          enable row level security;
alter table public.missions             enable row level security;
alter table public.candidatures         enable row level security;
alter table public.communes             enable row level security;
