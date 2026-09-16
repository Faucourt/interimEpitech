import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ConfigError, config } from './config';

/** Client Supabase avec la clé service_role : contourne la RLS, réservé aux scripts serveur. */
export function createSupabase(): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new ConfigError(
      'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour écrire en base.\n' +
        'Renseigner data/.env (modèle : data/.env.example) ou back/.env, puis relancer.\n' +
        'Pour tester sans base : ajouter --dry-run.',
    );
  }
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface UpsertOptions {
  batchSize?: number;
  /** Appelé après chaque lot avec le cumul de lignes envoyées. */
  onBatch?: (done: number, total: number) => void;
}

/**
 * Upsert par lots : `onConflict` désigne la clé unique de la table, ce qui rend l'import rejouable
 * (une ligne déjà présente est mise à jour, jamais dupliquée). Retourne le nombre de lignes envoyées.
 */
export async function upsertInBatches<Row extends object>(
  supabase: SupabaseClient,
  table: string,
  rows: Row[],
  onConflict: string,
  options: UpsertOptions = {},
): Promise<number> {
  const batchSize = options.batchSize ?? 1000;
  let written = 0;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      throw new Error(`Écriture dans ${table} (lot ${start / batchSize + 1}) : ${error.message}`);
    }
    written += batch.length;
    options.onBatch?.(written, rows.length);
  }
  return written;
}
