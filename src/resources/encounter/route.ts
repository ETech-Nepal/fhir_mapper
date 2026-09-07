import type { FastifyInstance } from 'fastify';
import { findPatientReference, HapiError, HapiPatientNotFoundError } from '../../clients/hapi.js';
import { validateEncounter, ValidatorError } from '../../clients/validator.js';
import { MappingError } from '../../shared/errors.js';
import { mapEncounter, validateEncounterInput } from './mapper.js';

export interface EncounterRouteDependencies {
  mapEncounter?: typeof mapEncounter;
  validateEncounter?: typeof validateEncounter;
  findPatientReference?: typeof findPatientReference;
}

export function registerEncounterRoute(app: FastifyInstance, deps: EncounterRouteDependencies = {}): void {
  const mapper = deps.mapEncounter ?? mapEncounter;
  const validator = deps.validateEncounter ?? validateEncounter;
  const findPatient = deps.findPatientReference ?? findPatientReference;

  app.post<{ Body: unknown }>('/convert/encounter', async (request, reply) => {
    let patientReference: string;
    try {
      validateEncounterInput(request.body);
      patientReference = hasPatientReference(request.body)
        ? request.body.patientReference as string
        : await findPatient(nationalId(request.body));
    } catch (error) {
      if (error instanceof MappingError) {
        return reply.code(400).send({ error: 'mapping_failed', field: error.field, message: error.message });
      }
      if (error instanceof HapiPatientNotFoundError) {
        return reply.code(404).send({ error: 'patient_not_found', message: error.message });
      }
      if (error instanceof HapiError) {
        return reply.code(502).send({ error: 'hapi_unavailable', message: error.message });
      }
      throw error;
    }

    let encounter;
    try {
      encounter = mapper(request.body, patientReference);
    } catch (error) {
      if (error instanceof MappingError) {
        return reply.code(400).send({ error: 'mapping_failed', field: error.field, message: error.message });
      }
      throw error;
    }

    let result;
    try {
      result = await validator(encounter);
    } catch (error) {
      if (error instanceof ValidatorError) {
        return reply.code(502).send({ error: 'validator_unavailable', message: error.message });
      }
      throw error;
    }

    if (!result.valid) return reply.code(422).send({ error: 'validation_failed', issues: result.issues });
    return reply.code(200).send(encounter);
  });
}

function hasPatientReference(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.hasOwn(value, 'patientReference');
}

function nationalId(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MappingError('body', 'request body must be a JSON object');
  }
  const nationalId = (value as Record<string, unknown>).nationalId;
  if (typeof nationalId !== 'string' || !nationalId.trim()) {
    throw new MappingError('nationalId', 'nationalId is required when patientReference is absent');
  }
  return nationalId;
}
