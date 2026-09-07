import Fastify, { type FastifyInstance } from 'fastify';
import { registerEncounterRoute, type EncounterRouteDependencies } from './resources/encounter/route.js';
import { registerPatientRoute, type PatientRouteDependencies } from './resources/patient/route.js';

export type AppDependencies = PatientRouteDependencies & EncounterRouteDependencies;

export function buildApp(deps: AppDependencies = {}): FastifyInstance {
  const app = Fastify();
  registerPatientRoute(app, deps);
  registerEncounterRoute(app, deps);
  return app;
}
