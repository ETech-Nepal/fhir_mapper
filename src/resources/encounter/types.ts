import type { Encounter } from '../../shared/fhir.js';

export interface EncounterInput {
  encounterId: string;
  facilityNhfrCode: string;
  status: string;
  classCode: string;
  start: string;
  nationalId?: string;
  patientReference?: string;
}

export type { Encounter };
