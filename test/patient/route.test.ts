import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../../src/app.js';
import { MappingError } from '../../src/shared/errors.js';
import { ValidatorError, validateResource } from '../../src/clients/validator.js';

test('POST /convert/patient returns the mapped resource when valid', async (t: { after(callback: () => unknown): void }) => {
  const app = buildApp({
    mapPatient: () => ({ resourceType: 'Patient', id: 'patient-1' } as never),
    validatePatient: async () => ({ valid: true, issues: [] })
  });
  t.after(() => app.close());

  const response = await app.inject({ method: 'POST', url: '/convert/patient', payload: {} });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { resourceType: 'Patient', id: 'patient-1' });
});

test('POST /convert/patient reports mapping errors', async (t: { after(callback: () => unknown): void }) => {
  const app = buildApp({
    mapPatient: () => { throw new MappingError('name', 'name is required'); },
    validatePatient: async () => ({ valid: true, issues: [] })
  });
  t.after(() => app.close());

  const response = await app.inject({ method: 'POST', url: '/convert/patient', payload: {} });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { error: 'mapping_failed', field: 'name', message: 'name is required' });
});

test('POST /convert/patient reports invalid validator results', async (t: { after(callback: () => unknown): void }) => {
  const app = buildApp({
    mapPatient: () => ({ resourceType: 'Patient' } as never),
    validatePatient: async () => ({ valid: false, issues: [{ severity: 'error', code: 'invalid' }] })
  });
  t.after(() => app.close());

  const response = await app.inject({ method: 'POST', url: '/convert/patient', payload: {} });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: 'validation_failed',
    issues: [{ severity: 'error', code: 'invalid' }]
  });
});

test('POST /convert/patient reports validator service errors', async (t: { after(callback: () => unknown): void }) => {
  const app = buildApp({
    mapPatient: () => ({ resourceType: 'Patient' } as never),
    validatePatient: async () => { throw new ValidatorError('validator process failed'); }
  });
  t.after(() => app.close());

  const response = await app.inject({ method: 'POST', url: '/convert/patient', payload: {} });

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.json(), { error: 'validator_unavailable', message: 'validator process failed' });
});

test('POST /convert/patient reports OperationOutcomes without issues as validator service errors', async () => {
  const responses = [];
  for (const outcome of [
    { resourceType: 'OperationOutcome' },
    { resourceType: 'OperationOutcome', issue: [] }
  ]) {
    const app = buildApp({
      mapPatient: () => ({ resourceType: 'Patient' } as never),
      validatePatient: (resource) => validateResource(resource, 'https://example.test/profile', async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(outcome)
      } as Response))
    });
    const response = await app.inject({ method: 'POST', url: '/convert/patient', payload: {} });
    responses.push({ statusCode: response.statusCode, body: response.json() });
    await app.close();
  }

  assert.deepEqual(responses, [
    {
      statusCode: 502,
      body: {
        error: 'validator_unavailable',
        message: 'validator output was not an OperationOutcome or Bundle of OperationOutcomes'
      }
    },
    {
      statusCode: 502,
      body: {
        error: 'validator_unavailable',
        message: 'validator output was not an OperationOutcome or Bundle of OperationOutcomes'
      }
    }
  ]);
});
