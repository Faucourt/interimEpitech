import type { RawOffre } from './clean';

// Documentation : https://francetravail.io/data/api/offres-emploi
const TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire';
const SEARCH_URL = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search';
const SCOPE = 'api_offresdemploiv2 o2dsoffre';
/** Taille maximale d'une page acceptée par l'API. */
const PAGE_SIZE = 150;
/** L'API refuse tout `range` au-delà de 3149 : 3 150 offres au plus par recherche. */
const MAX_RESULTS = 3150;
/** Pause entre deux pages pour rester sous le quota (10 appels/seconde). */
const PAGE_DELAY_MS = 150;

/** Jeton OAuth2 client credentials, valable environ 25 minutes : largement assez pour un import. */
export async function fetchAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: SCOPE,
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(
      `Authentification France Travail refusée (${response.status}). Vérifier FRANCE_TRAVAIL_CLIENT_ID / ` +
        "FRANCE_TRAVAIL_CLIENT_SECRET et que l'application est bien abonnée à l'API « Offres d'emploi v2 ».",
    );
  }
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Réponse OAuth2 France Travail sans access_token.');
  return json.access_token;
}

/** « offres 0-149/1234 » → 1234 ; null si l'en-tête est absent ou illisible. */
export function parseContentRangeTotal(header: string | null): number | null {
  const match = /\/(\d+)\s*$/.exec(header ?? '');
  return match ? Number(match[1]) : null;
}

export interface FetchOffersOptions {
  codeRome: string;
  /** Nombre maximal d'offres à récupérer (plafonné à 3 150 par l'API). */
  limit?: number;
  onPage?: (fetched: number, total: number | null) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Parcourt les pages de résultats. 200 = dernière page, 206 = il en reste, 204 = aucune offre. */
export async function fetchOffers(token: string, options: FetchOffersOptions): Promise<RawOffre[]> {
  const max = Math.min(options.limit ?? MAX_RESULTS, MAX_RESULTS);
  const offers: RawOffre[] = [];

  for (let start = 0; start < max; start += PAGE_SIZE) {
    const end = Math.min(start + PAGE_SIZE, max) - 1;
    const url = `${SEARCH_URL}?codeROME=${encodeURIComponent(options.codeRome)}&range=${start}-${end}`;
    let response = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
    if (response.status === 429) {
      // Quota dépassé : une seule reprise après une seconde, l'API indique parfois le délai à attendre.
      await sleep(Number(response.headers.get('retry-after') ?? 1) * 1000);
      response = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
    }
    if (response.status === 204) break;
    if (response.status !== 200 && response.status !== 206) {
      throw new Error(`France Travail a répondu ${response.status} pour ${url}`);
    }

    const json = (await response.json()) as { resultats?: RawOffre[] };
    const page = json.resultats ?? [];
    offers.push(...page);
    options.onPage?.(offers.length, parseContentRangeTotal(response.headers.get('content-range')));

    if (response.status === 200 || page.length < PAGE_SIZE) break;
    await sleep(PAGE_DELAY_MS);
  }

  return offers.slice(0, max);
}
