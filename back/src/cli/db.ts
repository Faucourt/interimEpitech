import { Pool } from 'pg';
import { ConfigError, config } from './config';

/**
 * Pool PostgreSQL du CLI. Aucune connexion n'est ouverte avant la première requête ; à fermer
 * (`pool.end()`) à la fin de chaque commande, sinon le processus ne se termine pas.
 */
export function createPool(): Pool {
  if (!config.databaseUrl) {
    throw new ConfigError(
      'DATABASE_URL est requis pour écrire en base.\n' +
        'Renseigner back/.env (modèle : back/.env.example) et démarrer PostgreSQL avec\n' +
        '`docker compose up -d` à la racine du dépôt, puis relancer.\n' +
        'Pour tester sans base : ajouter --dry-run.',
    );
  }
  return new Pool({ connectionString: config.databaseUrl });
}

export interface UpsertOptions {
  batchSize?: number;
  /** Appelé après chaque lot avec le cumul de lignes envoyées. */
  onBatch?: (done: number, total: number) => void;
}

/** Une requête PostgreSQL n'accepte pas plus de 65 535 paramètres, et chaque valeur en consomme un. */
const MAX_PARAMETERS = 65535;

/**
 * Upsert par lots : `conflictColumns` désigne la clé unique de la table, ce qui rend l'import rejouable
 * (une ligne déjà présente est mise à jour, jamais dupliquée). Toutes les lignes doivent avoir les
 * colonnes de la première. Retourne le nombre de lignes envoyées.
 */
export async function upsertInBatches<Row extends object>(
  pool: Pool,
  table: string,
  rows: Row[],
  conflictColumns: string[],
  options: UpsertOptions = {},
): Promise<number> {
  if (rows.length === 0) return 0;
  const columns = Object.keys(rows[0]);
  const batchSize = Math.min(options.batchSize ?? 1000, Math.floor(MAX_PARAMETERS / columns.length));
  const updates = columns
    .filter((column) => !conflictColumns.includes(column))
    .map((column) => `${column} = excluded.${column}`);
  const onConflict = updates.length > 0 ? `do update set ${updates.join(', ')}` : 'do nothing';

  let written = 0;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    // Un tuple « ($1, $2, …) » par ligne, les valeurs à plat dans le même ordre.
    const values: unknown[] = [];
    const tuples = batch.map((row) => {
      const placeholders = columns.map((column) => {
        values.push((row as Record<string, unknown>)[column]);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const sql =
      `insert into ${table} (${columns.join(', ')}) values ${tuples.join(', ')} ` +
      `on conflict (${conflictColumns.join(', ')}) ${onConflict}`;
    try {
      await pool.query(sql, values);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Écriture dans ${table} (lot ${start / batchSize + 1}) : ${message}`, { cause: error });
    }
    written += batch.length;
    options.onBatch?.(written, rows.length);
  }
  return written;
}
