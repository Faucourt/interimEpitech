import { Pool, types } from 'pg';
import { config } from '../config';

// Forme des valeurs renvoyées par le driver, pour que les dépôts reçoivent des types simples :
// - `date` reste une chaîne AAAA-MM-JJ (convertie en Date, elle se décalerait d'un jour selon le fuseau) ;
// - `timestamptz` / `timestamp` deviennent des chaînes ISO, telles que l'API les renvoie au client ;
// - `numeric` et `int8` (les `count(*)`) deviennent des nombres, pas des chaînes.
types.setTypeParser(types.builtins.DATE, (value) => value);
types.setTypeParser(types.builtins.TIMESTAMPTZ, (value) => new Date(value).toISOString());
types.setTypeParser(types.builtins.TIMESTAMP, (value) => new Date(value).toISOString());
types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));
types.setTypeParser(types.builtins.INT8, (value) => Number(value));

/**
 * Pool de connexions PostgreSQL partagé par l'API et les scripts `db:*`. Aucune connexion n'est
 * ouverte avant la première requête : en test, où les dépôts mémoire remplacent la base, ce module
 * n'est jamais importé.
 */
export const pool = new Pool({ connectionString: config.databaseUrl });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Les identifiants arrivent parfois bruts de l'URL (`/api/missions/:id`). Comparer une colonne
 * `uuid` à un texte malformé est une erreur SQL : les dépôts testent d'abord le format et
 * répondent « introuvable », comme pour un identifiant inconnu.
 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Message d'une erreur de requête, pour le recontextualiser (« Création de la mission impossible : … »). */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
