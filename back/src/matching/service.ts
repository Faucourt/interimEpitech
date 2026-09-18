import type { Repositories } from '../repositories';
import { toPublicUser, type Mission, type Profile, type PublicUser } from '../types';
import { computeScore, isAvailable, type GeoPoint, type Score } from './score';

export interface Candidate {
  interimaire: PublicUser;
  profil: Profile;
  score: Score;
}

export interface Recommendation {
  mission: Mission;
  score: Score;
}

/**
 * Charge ce dont le score a besoin (communes, expériences, compétences qualifiées) et applique
 * le filtre de disponibilité avant de scorer. Le calcul lui-même est dans `score.ts`.
 */
export function createMatchingService(
  repos: Pick<Repositories, 'users' | 'profiles' | 'communes' | 'competences' | 'matchingLogs'>,
) {
  // Cache par appel : plusieurs agents partagent souvent le même code postal.
  function communeLocator() {
    const cache = new Map<string, Promise<GeoPoint | null>>();
    return (codePostal: string | null): Promise<GeoPoint | null> => {
      if (codePostal === null) return Promise.resolve(null);
      if (!cache.has(codePostal)) cache.set(codePostal, repos.communes.findByCodePostal(codePostal));
      return cache.get(codePostal)!;
    };
  }

  /**
   * Journalise un score dans la base non relationnelle (historique, notifications n8n).
   * Jamais attendu par l'appelant et ne lève jamais : un incident Mongo est logué, la réponse HTTP
   * n'en dépend pas. Un score n'est calculé que pour un agent compatible (filtre éliminatoire
   * `isAvailable`), d'où `disponibiliteCompatible` toujours vrai ici.
   */
  async function logScore(mission: Mission, profile: Profile, result: Score): Promise<void> {
    try {
      await repos.matchingLogs.insert({
        missionId: mission.id,
        interimaireId: profile.userId,
        scoreTotal: result.total,
        scoreMotsCles: result.details.motsCles,
        scoreDernieresMissions: result.details.experiences,
        scoreLocalisation: result.details.localisation,
        disponibiliteCompatible: true,
      });
    } catch (err) {
      console.error(`[matching] Journalisation du score impossible (mission ${mission.id}, agent ${profile.userId}) :`, err);
    }
  }

  async function score(
    mission: Mission,
    profile: Profile,
    locate: ReturnType<typeof communeLocator>,
  ): Promise<Score> {
    const [missionCommune, profileCommune, experiences, competencesQualifiees] = await Promise.all([
      locate(mission.codePostal),
      locate(profile.codePostal),
      repos.profiles.listExperiences(profile.userId),
      repos.competences.listByProfil(profile.userId),
    ]);
    const result = computeScore({
      mission,
      missionCommune,
      profile: { ...profile, competencesQualifiees },
      profileCommune,
      experiences,
    });
    void logScore(mission, profile, result);
    return result;
  }

  const byScoreDesc = (a: { score: Score }, b: { score: Score }) => b.score.total - a.score.total;

  return {
    /** Agents disponibles pour une mission, du meilleur score au moins bon. */
    async candidatesFor(mission: Mission): Promise<Candidate[]> {
      const locate = communeLocator();
      const profiles = (await repos.profiles.listAvailable()).filter((p) => isAvailable(p, mission));
      const users = await repos.users.findByIds(profiles.map((p) => p.userId));
      const candidates = await Promise.all(
        profiles.map(async (profil) => {
          const user = users.find((u) => u.id === profil.userId);
          if (!user || !user.isActive) return null;
          return { interimaire: toPublicUser(user), profil, score: await score(mission, profil, locate) };
        }),
      );
      return candidates.filter((c): c is Candidate => c !== null).sort(byScoreDesc);
    },

    /** Missions ouvertes compatibles avec l'agent, du meilleur score au moins bon. */
    async recommendationsFor(profile: Profile, openMissions: Mission[]): Promise<Recommendation[]> {
      const locate = communeLocator();
      const compatible = openMissions.filter((mission) => isAvailable(profile, mission));
      const recommendations = await Promise.all(
        compatible.map(async (mission) => ({ mission, score: await score(mission, profile, locate) })),
      );
      return recommendations.sort(byScoreDesc);
    },

    /** Score d'un agent sur une mission, ou null s'il est indisponible (il ne peut alors pas candidater). */
    async scoreFor(mission: Mission, profile: Profile): Promise<Score | null> {
      if (!isAvailable(profile, mission)) return null;
      return score(mission, profile, communeLocator());
    },
  };
}

export type MatchingService = ReturnType<typeof createMatchingService>;
