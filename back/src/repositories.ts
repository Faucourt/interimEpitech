import type { CandidatureRepository } from './candidatures/repository';
import type { CommuneRepository } from './communes/repository';
import type { CompetenceRepository } from './competences/repository';
import type { MatchingLogRepository } from './matchingLogs/repository';
import type { MissionRepository } from './missions/repository';
import type { ProfileRepository } from './profils/repository';
import type { TendanceRepository } from './tendances/repository';
import type { UserRepository } from './users/repository';

/** Ensemble des dépôts injectés dans l'application : PostgreSQL (et MongoDB pour les logs) en prod, mémoire en test. */
export interface Repositories {
  users: UserRepository;
  profiles: ProfileRepository;
  missions: MissionRepository;
  candidatures: CandidatureRepository;
  communes: CommuneRepository;
  competences: CompetenceRepository;
  tendances: TendanceRepository;
  /** Base non relationnelle : journal des scores de matching. */
  matchingLogs: MatchingLogRepository;
}
