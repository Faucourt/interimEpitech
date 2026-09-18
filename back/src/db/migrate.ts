import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { errorMessage, pool } from './pool';

// Fichiers SQL du dépôt (back/sql), appliqués par ordre alphabétique : d'où leur préfixe numérique.
const SQL_DIR = path.resolve(__dirname, '..', '..', 'sql');

/**
 * Applique les migrations pas encore passées, chacune dans sa transaction, et les note dans
 * `schema_migrations`. Rejouable sans effet : un fichier déjà appliqué est ignoré.
 */
async function migrate(): Promise<void> {
  await pool.query(`
    create table if not exists schema_migrations (
      nom         text primary key,
      applique_le timestamptz not null default now()
    )`);
  const { rows } = await pool.query<{ nom: string }>('select nom from schema_migrations');
  const applied = new Set(rows.map((row) => row.nom));

  const files = (await readdir(SQL_DIR)).filter((file) => file.endsWith('.sql')).sort();
  const pending = files.filter((file) => !applied.has(file));
  if (pending.length === 0) {
    console.log(`[migrate] Base à jour, rien à appliquer (${files.length} migration(s) déjà passée(s))`);
    return;
  }

  for (const file of pending) {
    const sql = await readFile(path.join(SQL_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (nom) values ($1)', [file]);
      await client.query('commit');
      console.log(`[migrate] ${file} appliquée`);
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw new Error(`Migration ${file} échouée : ${errorMessage(err)}`, { cause: err });
    } finally {
      client.release();
    }
  }
  console.log(`[migrate] ${pending.length} migration(s) appliquée(s)`);
}

migrate()
  .catch((err) => {
    console.error('[migrate]', errorMessage(err));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
