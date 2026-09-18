import { config } from '../config';
import type { Candidate, MatchingService } from '../matching/service';
import type { Mission } from '../types';

/** Seuil de notification : seuls les agents dont le score dépasse strictement 70/100 sont prévenus. */
export const NOTIFICATION_SCORE_THRESHOLD = 70;

/** Délai maximal accordé à n8n : la mission est déjà créée, inutile d'attendre plus longtemps. */
const TIMEOUT_MS = 3000;

/** Payload du webhook « mission publiée » (workflow 1), contrat défini dans README.md (section « Automatisations n8n »). */
export interface MissionPublishedPayload {
  mission: {
    id: string;
    intitule: string;
    ville: string;
    codePostal: string;
    dateDebut: string;
    dateFin: string;
    creneau: string | null;
    remuneration: number | null;
    url: string;
  };
  agents: { id: string; prenom: string | null; nom: string | null; email: string; score: number }[];
}

export function buildMissionPublishedPayload(mission: Mission, candidates: Candidate[]): MissionPublishedPayload {
  return {
    mission: {
      id: mission.id,
      intitule: mission.intitule,
      ville: mission.ville,
      codePostal: mission.codePostal,
      dateDebut: mission.dateDebut,
      dateFin: mission.dateFin,
      creneau: mission.creneau,
      remuneration: mission.remuneration,
      // Fiche publique de la mission côté front (CORS_ORIGIN est l'origine du front).
      url: `${config.corsOrigin}/missions/${mission.id}`,
    },
    // n8n re-filtre sur le même seuil ; on n'envoie que le nécessaire (l'email est une donnée personnelle).
    agents: candidates
      .filter((c) => c.score.total > NOTIFICATION_SCORE_THRESHOLD)
      .map((c) => ({
        id: c.interimaire.id,
        prenom: c.interimaire.prenom,
        nom: c.interimaire.nom,
        email: c.interimaire.email,
        score: c.score.total,
      })),
  };
}

/**
 * Prévient n8n qu'une mission vient d'être publiée, avec les agents qui la matchent.
 * Ne lève jamais : sans N8N_WEBHOOK_URL l'appel est désactivé, et toute erreur (n8n éteint,
 * réseau, timeout, réponse non 2xx) est seulement loguée. La création de la mission n'en dépend pas.
 */
export async function notifyMissionPublished(mission: Mission, matching: MatchingService): Promise<void> {
  if (!config.n8nWebhookUrl) return;
  try {
    const payload = buildMissionPublishedPayload(mission, await matching.candidatesFor(mission));
    const response = await fetch(config.n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': config.n8nApiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[n8n] Webhook « mission publiée » : réponse ${response.status} pour la mission ${mission.id}`);
    }
  } catch (err) {
    console.error(`[n8n] Webhook « mission publiée » injoignable pour la mission ${mission.id} :`, err);
  }
}
