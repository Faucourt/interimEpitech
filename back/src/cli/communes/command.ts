import { createPool, upsertInBatches } from '../db';
import { log, n } from '../format';
import { cleanCommunes, type CommuneRow, type RejectReason } from './clean';
import { fetchArrondissements, fetchCommunes } from './fetch';

const TABLE = 'communes';
const BATCH_SIZE = 1000;
/** Code postal témoin : le cas de référence du matching (Paris 12e vs Vincennes). */
const CONTROL_CODE_POSTAL = '75012';

const REASON_LABELS: Record<RejectReason, string> = {
  sans_nom: 'sans nom',
  sans_code_postal: 'sans code postal',
  sans_coordonnees: 'sans coordonnées',
  coordonnees_invalides: 'coordonnées invalides',
};

export interface CommunesOptions {
  dryRun: boolean;
  limit?: number;
}

function describe(row: CommuneRow): string {
  return `${row.code_postal} ${row.nom} (lat ${row.latitude}, lon ${row.longitude})`;
}

export async function runCommunes(options: CommunesOptions): Promise<void> {
  log('Récupération depuis geo.api.gouv.fr…');
  const [allCommunes, arrondissements] = await Promise.all([fetchCommunes(), fetchArrondissements()]);
  const communes = options.limit ? allCommunes.slice(0, options.limit) : allCommunes;
  const limitNote = options.limit ? ` (limitées aux ${n(communes.length)} premières)` : '';
  log(`  ${n(allCommunes.length)} communes${limitNote}, ${n(arrondissements.length)} arrondissements municipaux`);

  const report = cleanCommunes(communes, arrondissements);
  log('Nettoyage :');
  log(`  ${n(report.exploded)} couples (code postal, commune) après éclatement des codes postaux multiples`);
  log(`  ${n(report.overriddenByArrondissement)} lignes de commune globale remplacées par leur arrondissement (Paris, Lyon, Marseille)`);
  log(`  ${n(report.duplicatesRemoved)} doublons (code postal, nom) supprimés`);
  log(`  ${n(report.rejected.length)} entrées écartées`);
  for (const rejected of report.rejected.slice(0, 10)) {
    const code = rejected.code ? ` [${rejected.code}]` : '';
    log(`    - ${rejected.nom || '(sans nom)'}${code} : ${REASON_LABELS[rejected.reason]}`);
  }
  if (report.rejected.length > 10) log(`    … et ${n(report.rejected.length - 10)} autres`);
  log(`  → ${n(report.rows.length)} lignes prêtes pour la table ${TABLE}`);

  const control = report.rows.filter((row) => row.code_postal === CONTROL_CODE_POSTAL);
  log(
    `Contrôle ${CONTROL_CODE_POSTAL} : ${control.length ? control.map(describe).join(' ; ') : 'absent du jeu (limite trop basse ?)'}`,
  );

  const batches = Math.ceil(report.rows.length / BATCH_SIZE);
  if (options.dryRun) {
    log(
      `[dry-run] aucune écriture : ${n(report.rows.length)} lignes auraient été envoyées à ${TABLE} ` +
        `en ${n(batches)} lots (upsert sur code_postal + nom).`,
    );
    log('[dry-run] aperçu des premières lignes :');
    for (const row of report.rows.slice(0, 5)) log(`    ${describe(row)}`);
    return;
  }

  const pool = createPool();
  try {
    log(`Écriture dans ${TABLE} : ${n(batches)} lots de ${n(BATCH_SIZE)}, upsert sur code_postal + nom…`);
    const written = await upsertInBatches(pool, TABLE, report.rows, ['code_postal', 'nom'], {
      batchSize: BATCH_SIZE,
      onBatch: (done, total) => {
        const batch = Math.ceil(done / BATCH_SIZE);
        if (batch % 10 === 0 || done === total) log(`  lot ${batch}/${batches} — ${n(done)}/${n(total)} lignes`);
      },
    });
    log(`  ${n(written)} lignes écrites. Import rejouable : relancer ne crée pas de doublon.`);

    // Relecture avec la requête exacte du back (première commune du code postal, ordre alphabétique).
    const { rows: [{ count }] } = await pool.query<{ count: number }>(`select count(*)::int as count from ${TABLE}`);
    const { rows: [found] } = await pool.query<CommuneRow>(
      `select code_postal, nom, latitude, longitude from ${TABLE} where code_postal = $1 order by nom limit 1`,
      [CONTROL_CODE_POSTAL],
    );
    log(
      `Vérification en base : ${n(count)} lignes dans ${TABLE} ; ${CONTROL_CODE_POSTAL} → ${found ? describe(found) : 'introuvable'}`,
    );
  } finally {
    await pool.end();
  }
}
