import assert from 'node:assert/strict';
import test from 'node:test';
import { HapiError, HapiPatientNotFoundError, findPatientReference } from '../../src/clients/hapi.js';

const response = (body: unknown, ok = true, status = 200): Response => ({
  ok,
  status,
  json: async () => body
} as Response);

test('finds a Patient reference from a HAPI search Bundle', async () => {
  const result = await findPatientReference('national id', async () => response({
    resourceType: 'Bundle',
    entry: [{ resource: { resourceType: 'Patient', id: '123' } }]
  }));

  assert.equal(result, 'Patient/123');
});

test('encodes the national ID in the HAPI identifier query', async () => {
  let url = '';
  await findPatientReference('national id', async (input) => {
    url = String(input);
    return response({ resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Patient', id: '123' } }] });
  });

  assert.match(url, /identifier=http%3A%2F%2Fdonidcr.gov.np%7Cnational%20id/);
});

test('reports an empty HAPI search Bundle as not found', async () => {
  await assert.rejects(
    () => findPatientReference('missing', async () => response({ resourceType: 'Bundle', entry: [] })),
    HapiPatientNotFoundError
  );
});

test('reports a malformed HAPI response as a service error', async () => {
  await assert.rejects(
    () => findPatientReference('bad', async () => response({ resourceType: 'OperationOutcome' })),
    HapiError
  );
});

test('reports malformed HAPI JSON as a service error', async () => {
  await assert.rejects(
    () => findPatientReference('bad-json', async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token'); }
    } as unknown as Response)),
    HapiError
  );
});

test('reports HAPI fetch failures as service errors', async () => {
  await assert.rejects(
    () => findPatientReference('offline', async () => { throw new Error('connection refused'); }),
    (error: unknown) => error instanceof HapiError && /connection refused/.test(error.message)
  );
});

test('reports non-success HAPI responses as service errors', async () => {
  await assert.rejects(
    () => findPatientReference('unavailable', async () => response({}, false, 503)),
    (error: unknown) => error instanceof HapiError && /503/.test(error.message)
  );
});
