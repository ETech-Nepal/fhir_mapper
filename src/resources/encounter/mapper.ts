import type { Encounter } from '../../shared/fhir.js';
import { MappingError } from '../../shared/errors.js';
import type { EncounterInput } from './types.js';

const PROFILE = 'http://fhir.digitalhealth.gov.np/core/StructureDefinition/np-core-encounter';
const ACT_CODE = 'http://terminology.hl7.org/CodeSystem/v3-ActCode';
const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function requiredString(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (typeof value !== 'string' || !value.trim()) throw new MappingError(field, `${field} is required`);
  return value;
}

function validDateTime(value: string): boolean {
  const match = DATE_TIME_RE.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day] = match.slice(1).map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function validateEncounterInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new MappingError('body', 'request body must be a JSON object');
  }
  const body = input as Record<string, unknown>;
  const encounterId = requiredString(body, 'encounterId');
  const facilityNhfrCode = requiredString(body, 'facilityNhfrCode');
  if (facilityNhfrCode.includes('/')) throw new MappingError('facilityNhfrCode', 'facilityNhfrCode must not contain /');
  const status = requiredString(body, 'status');
  const classCode = requiredString(body, 'classCode');
  const start = requiredString(body, 'start');
  if (!validDateTime(start)) throw new MappingError('start', 'start must be an ISO date-time with timezone');
  return { encounterId, facilityNhfrCode, status, classCode, start };
}

export function mapEncounter(input: unknown, patientReference: string): Encounter {
  const { encounterId, facilityNhfrCode, status, classCode, start } = validateEncounterInput(input);
  if (typeof patientReference !== 'string' || !/^Patient\/[^/]+$/.test(patientReference)) {
    throw new MappingError('patientReference', 'patientReference must be Patient/{id}');
  }

  return {
    resourceType: 'Encounter',
    meta: { profile: [PROFILE] },
    identifier: [{ use: 'official', system: `http://nhfr.digitalhealth.gov.np/${facilityNhfrCode}`, value: encounterId }],
    status,
    class: { system: ACT_CODE, code: classCode },
    subject: { reference: patientReference },
    period: { start }
  };
}

export type { EncounterInput };
