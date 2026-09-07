import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../../src/app.js';
import { HapiError, HapiPatientNotFoundError } from '../../src/clients/hapi.js';
import { ValidatorError } from '../../src/clients/validator.js';
import { MappingError } from '../../src/shared/errors.js';

const encounter = (reference: string) => ({ resourceType: 'Encounter', subject: { reference } } as never);
const input = {
  encounterId: 'ENC-123',
  facilityNhfrCode: '00XX',
  status: 'finished',
  classCode: 'AMB',
  start: '2026-09-03T10:30:00+05:45'
};

test('POST /convert/encounter uses a direct patientReference without HAPI', async (t: { after(callback: () => unknown): void }) => {
  const app = buildApp({
    mapEncounter: (_, reference) => encounter(reference),
    validateEncounter: async () => ({ valid: true, issues: [] }),
    findPatientReference: async () => { throw new Error('HAPI should not be called'); }
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST', url: '/convert/encounter', payload: { ...input, patientReference: 'Patient/direct' }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { resourceType: 'Encounter', subject: { reference: 'Patient/direct' } });
});

test('POST /convert/encounter resolves a national ID through HAPI', async (t: { after(callback: () => unknown): void }) => {
  const app = buildApp({
    mapEncounter: (_, reference) => encounter(reference),
    validateEncounter: async () => ({ valid: true, issues: [] }),
    findPatientReference: async (nationalId) => nationalId === '123' ? 'Patient/resolved' : 'Patient/wrong'
  });
  t.after(() => app.close());

  const response = await app.inject({ method: 'POST', url: '/convert/encounter', payload: { ...input, nationalId: '123' } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { resourceType: 'Encounter', subject: { reference: 'Patient/resolved' } });
});

test('POST /convert/encounter reports an absent HAPI Patient', async (t: { after(callback: () => unknown): void }) => {
  const app = buildApp({
    findPatientReference: async () => { throw new HapiPatientNotFoundError('no Patient found'); }
  });
  t.after(() => app.close());

  const response = await app.inject({ method: 'POST', url: '/convert/encounter', payload: { ...input, nationalId: 'missing' } });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: 'patient_not_found', message: 'no Patient found' });
});

test('POST /convert/encounter reports mapping errors', async (t: { after(callback: () => unknown): void }) => {
  const app = buildApp({
    mapEncounter: () => { throw new MappingError('status', 'status is required'); },
    validateEncounter: async () => ({ valid: true, issues: [] })
  });
  t.after(() => app.close());

  const response = await app.inject({ method: 'POST', url: '/convert/encounter', payload: { ...input, patientReference: 'Patient/direct' } });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { error: 'mapping_failed', field: 'status', message: 'status is required' });
});

test('POST /convert/encounter reports invalid validator results', async (t: { after(callback: () => unknown): void }) => {
  const app = buildApp({
    mapEncounter: (_, reference) => encounter(reference),
    validateEncounter: async () => ({ valid: false, issues: [{ severity: 'error', code: 'invalid' }] })
  });
  t.after(() => app.close());

  const response = await app.inject({ method: 'POST', url: '/convert/encounter', payload: { ...input, patientReference: 'Patient/direct' } });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: 'validation_failed',
    issues: [{ severity: 'error', code: 'invalid' }]
  });
});

test('POST /convert/encounter reports HAPI and validator service errors', async (t: { after(callback: () => unknown): void }) => {
  const hapiApp = buildApp({
    findPatientReference: async () => { throw new HapiError('HAPI unavailable'); }
  });
  const validatorApp = buildApp({
    mapEncounter: (_, reference) => encounter(reference),
    validateEncounter: async () => { throw new ValidatorError('validator unavailable'); }
  });
  t.after(() => Promise.all([hapiApp.close(), validatorApp.close()]));

  const hapiResponse = await hapiApp.inject({ method: 'POST', url: '/convert/encounter', payload: { ...input, nationalId: '123' } });
  const validatorResponse = await validatorApp.inject({ method: 'POST', url: '/convert/encounter', payload: { ...input, patientReference: 'Patient/direct' } });

  assert.equal(hapiResponse.statusCode, 502);
  assert.deepEqual(hapiResponse.json(), { error: 'hapi_unavailable', message: 'HAPI unavailable' });
  assert.equal(validatorResponse.statusCode, 502);
  assert.deepEqual(validatorResponse.json(), { error: 'validator_unavailable', message: 'validator unavailable' });
});

test('POST /convert/encounter rejects invalid required fields before HAPI lookup', async (t: { after(callback: () => unknown): void }) => {
  let hapiCalled = false;
  const app = buildApp({
    findPatientReference: async () => {
      hapiCalled = true;
      return 'Patient/resolved';
    }
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST', url: '/convert/encounter', payload: { ...input, status: '', nationalId: '123' }
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { error: 'mapping_failed', field: 'status', message: 'status is required' });
  assert.equal(hapiCalled, false);
});

test('POST /convert is no longer registered', async (t: { after(callback: () => unknown): void }) => {
  const app = buildApp();
  t.after(() => app.close());

  const response = await app.inject({ method: 'POST', url: '/convert', payload: {} });

  assert.equal(response.statusCode, 404);
});
