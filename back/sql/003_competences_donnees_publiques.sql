-- Alignement sur le diagramme de classes, limité à deux manques réels :
-- les compétences qualifiées (niveau + expérience) et les données publiques France Travail.

-- 1. Référentiel de compétences du secteur de la propreté.
create table if not exists public.competences (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null unique,
  description text
);

-- 2. Association agent <-> compétence, avec le niveau et l'ancienneté.
-- C'est l'apport principal du diagramme : aujourd'hui un agent qui coche « autolaveuse »
-- vaut autant qu'un expert de dix ans. Cette table permet de pondérer le matching.
create table if not exists public.interimaire_competences (
  profil_id          uuid not null references public.interimaire_profiles(user_id) on delete cascade,
  competence_id      uuid not null references public.competences(id) on delete cascade,
  niveau             text not null default 'DEBUTANT'
                       check (niveau in ('DEBUTANT', 'INTERMEDIAIRE', 'CONFIRME', 'EXPERT')),
  annees_experience  integer check (annees_experience >= 0),
  validee_le         date,
  primary key (profil_id, competence_id)
);
create index if not exists interimaire_competences_competence_idx
  on public.interimaire_competences (competence_id);

-- 3. Données publiques France Travail (tension de recrutement par métier / territoire).
-- Alimente le tableau de tendances marché de l'espace administrateur.
create table if not exists public.donnees_france_travail (
  id                      uuid primary key default gen_random_uuid(),
  code_rome               text not null,
  libelle_metier          text not null,
  region                  text,
  bassin_emploi           text,
  projets_recrutement     integer,
  difficulte_recrutement  double precision,
  annee                   integer not null,
  importe_le              timestamptz not null default now(),
  -- Un import régulier ne doit pas dupliquer les lignes.
  unique (code_rome, region, bassin_emploi, annee)
);
create index if not exists donnees_ft_rome_annee_idx
  on public.donnees_france_travail (code_rome, annee);

-- 4. Référentiel initial : les compétences citées au §3.2 du cahier des charges.
insert into public.competences (nom) values
  ('vitrerie'), ('nettoyage industriel'), ('autolaveuse'), ('désinfection'),
  ('remise en état'), ('nettoyage de bureaux'), ('parties communes'), ('propreté urbaine')
on conflict (nom) do nothing;
