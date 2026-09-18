#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { runCommunes } from './communes/command';
import { ConfigError } from './config';
import { runFranceTravail } from './franceTravail/command';

const program = new Command();

program
  .name('cleanmatch-data')
  .description(
    'Import et nettoyage des données publiques de CleanMatch vers PostgreSQL.\n' +
      'Chaque commande récupère une source ouverte, la nettoie (libellés, doublons, dates, lieux)\n' +
      'puis alimente une table utilisée par le produit. Ajouter --dry-run pour ne rien écrire.',
  )
  .version('0.1.0')
  .showHelpAfterError();

function parseLimit(value: string): number {
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new InvalidArgumentError('--limit attend un entier strictement positif.');
  }
  return limit;
}

/** Exécute une commande en transformant toute erreur en message lisible et en code de sortie 1. */
function guarded<Options>(run: (options: Options) => Promise<void>) {
  return async (options: Options): Promise<void> => {
    try {
      await run(options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(error instanceof ConfigError ? message : `Erreur : ${message}`);
      process.exitCode = 1;
    }
  };
}

program
  .command('communes')
  .description(
    'Communes françaises (geo.api.gouv.fr) → table `communes`.\n' +
      'Une ligne par couple (code postal, commune), coordonnées du centre, arrondissements de\n' +
      'Paris / Lyon / Marseille prioritaires sur la commune globale. Sert au critère de distance du matching.',
  )
  .option('--dry-run', "n'écrit rien en base, affiche ce qui serait fait", false)
  .option(
    '--limit <n>',
    'ne traite que les n premières communes récupérées (les arrondissements sont toujours tous traités)',
    parseLimit,
  )
  .action(guarded(runCommunes));

program
  .command('france-travail')
  .description(
    "Offres d'emploi France Travail (ROME K2204, nettoyage de locaux) → table `donnees_france_travail`.\n" +
      'Offres nettoyées puis agrégées par région, département et année. Alimente le tableau de\n' +
      "tendances marché de l'espace administrateur. Nécessite FRANCE_TRAVAIL_CLIENT_ID / _SECRET.",
  )
  .option('--dry-run', "n'écrit rien en base, affiche ce qui serait fait", false)
  .option('--limit <n>', 'ne récupère que les n premières offres', parseLimit)
  .option('--code-rome <code>', 'code ROME interrogé', 'K2204')
  .action(guarded(runFranceTravail));

void program.parseAsync(process.argv);
