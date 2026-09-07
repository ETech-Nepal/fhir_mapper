import type { FastifyInstance } from 'fastify';
import { validatePatient, ValidatorError } from '../../clients/validator.js';
import { MappingError } from '../../shared/errors.js';
import { mapPatient } from './mapper.js';

export interface PatientRouteDependencies {
  mapPatient?: typeof mapPatient;
  validatePatient?: typeof validatePatient;
}

export function registerPatientRoute(
  app: FastifyInstance,
  deps: PatientRouteDependencies = {},
): void {
  const mapper = deps.mapPatient ?? mapPatient;
  const validator = deps.validatePatient ?? validatePatient;

  app.post<{ Body: unknown }>('/convert/patient', async (request, reply) => {
    let patient;
    try {
      patient = mapper(request.body);
    } catch (error) {
      if (error instanceof MappingError) {
        return reply
          .code(400)
          .send({
            error: 'mapping_failed',
            field: error.field,
            message: error.message,
          });
      }
      throw error;
    }

    let result;
    try {
      result = await validator(patient);
    } catch (error) {
      if (error instanceof ValidatorError) {
        return reply
          .code(502)
          .send({ error: 'validator_unavailable', message: error.message });
      }
      throw error;
    }

    if (!result.valid)
      return reply
        .code(422)
        .send({ error: 'validation_failed', issues: result.issues });
    return reply.code(200).send(patient);
  });
}
