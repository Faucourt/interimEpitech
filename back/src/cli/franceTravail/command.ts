import { ConfigError, config } from '../config';
import { createPool, upsertInBatches } from '../db';
import { log, n, pct } from '../format';
import { cleanOffers, HARD_TO_FILL_AFTER_DAYS, type OfferRejectReason, type TendanceRow } from './clean';
import { fetchAccessToken, fetchOffers } from './fetch';

const TABLE = 'donnees_france_travail';
const BATCH_SIZE = 500;

const REASON_LABELS: Record<OfferRejectReason, string> = {
  sans_identifiant: 'sans identifiant',
  sans_intitule: 'sans intitulé',
  sans_code_rome: 'code ROME absent ou invalide',
  date_invalide: 'date de création invalide',
  lieu_inconnu: 'lieu non rattachable à un département',
};

const MISSING_CREDENTIALS =
  'Identifiants France Travail absents : FRANCE_TRAVAIL_CLIENT_ID et FRANCE_TRAVAIL_CLIENT_SECRET.\n' +
  '\n' +
  'Pour les obtenir (gratuit, quelques minutes) :\n' +
  '  1. Créer un compte sur https://francetravail.io\n' +
  '  2. Menu « Mes applications » → « Créer une application » (nom libre, ex. CleanMatch)\n' +
  "  3. Dans l'application, onglet « Catalogue » → souscrire à l'API « Offres d'emploi v2 »\n" +
  "  4. Copier l'identifiant client et la clé secrète dans back/.env (modèle : back/.env.example)\n" +
  '\n' +
  'Puis relancer : npm run import:france-travail -- --dry-run';

export interface FranceTravailOptions {
  dryRun: boolean;
  limit?: number;
  codeRome: string;
}

function describe(row: TendanceRow): string {
  return (
    `${row.annee} · ${row.region} · ${row.bassin_emploi} : ${n(row.projets_recrutement)} poste(s), ` +
    `difficulté ${pct(row.difficulte_recrutement)}`
  );
}

export async function runFranceTravail(options: FranceTravailOptions): Promise<void> {
  if (!config.franceTravailClientId || !config.franceTravailClientSecret) {
    throw new ConfigError(MISSING_CREDENTIALS);
  }

  log('Authentification France Travail (OAuth2 client credentials)…');
  const token = await fetchAccessToken(config.franceTravailClientId, config.franceTravailClientSecret);

  log(`Récupération des offres ROME ${options.codeRome}${options.limit ? ` (au plus ${n(options.limit)})` : ''}…`);
  const raws = await fetchOffers(token, {
    codeRome: options.codeRome,
    limit: options.limit,
    onPage: (fetched, total) => log(`  ${n(fetched)}${total !== null ? `/${n(total)}` : ''} offres`),
  });
  log(`  ${n(raws.length)} offres récupérées`);

  const now = new Date();
  const report = cleanOffers(raws, now);
  log('Nettoyage :');
  log(`  ${n(report.rejected.length)} offres écartées`);
  for (const [reason, count] of Object.entries(report.rejectedByReason)) {
    if (count > 0) log(`    - ${REASON_LABELS[reason as OfferRejectReason]} : ${n(count)}`);
  }
  log(`  ${n(report.duplicatesRemoved)} doublons supprimés (identifiant ou republication)`);
  log(`  ${n(report.offers.length)} offres conservées, intitulés et lieux normalisés`);
  log(
    `  → ${n(report.rows.length)} lignes agrégées (code ROME × région × département × année) ; ` +
      `difficulté = part des offres en ligne depuis plus de ${HARD_TO_FILL_AFTER_DAYS} jours`,
  );
  log('Aperçu :');
  for (const row of report.rows.slice(0, 5)) log(`    ${describe(row)}`);

  if (options.dryRun) {
    log(`[dry-run] aucune écriture : ${n(report.rows.length)} lignes auraient été envoyées à ${TABLE} (upsert sur code_rome + region + bassin_emploi + annee).`);
    return;
  }

  const pool = createPool();
  try {
    const rows = report.rows.map((row) => ({ ...row, importe_le: now.toISOString() }));
    log(`Écriture dans ${TABLE} (upsert sur code_rome + region + bassin_emploi + annee)…`);
    const written = await upsertInBatches(pool, TABLE, rows, ['code_rome', 'region', 'bassin_emploi', 'annee'], {
      batchSize: BATCH_SIZE,
    });
    log(`  ${n(written)} lignes écrites. Import rejouable : relancer met à jour les lignes existantes.`);
  } finally {
    await pool.end();
  }
}
