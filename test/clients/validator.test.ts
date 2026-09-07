import assert from 'node:assert/strict';
import test from 'node:test';
import { ValidatorError, extractIssues, validateEncounter, validatePatient, validateResource } from '../../src/clients/validator.js';

const response = (body: string, ok = true, status = 200): Response => ({
  ok,
  status,
  text: async () => body
} as Response);

test('extractIssues returns a valid result for informational OperationOutcome issues', () => {
  const result = extractIssues({
    resourceType: 'OperationOutcome',
    issue: [{ severity: 'information', code: 'informational', diagnostics: 'all good' }]
  });

  assert.deepEqual(result, {
    valid: true,
    issues: [{ severity: 'information', code: 'informational', diagnostics: 'all good', location: [] }]
  });
});

test('extractIssues aggregates OperationOutcome issues from a Bundle', () => {
  const result = extractIssues({
    resourceType: 'Bundle',
    entry: [
      { resource: { resourceType: 'OperationOutcome', issue: [{ severity: 'warning', code: 'business-rule' }] } },
      { resource: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid', expression: ['Patient.gender'] }] } }
    ]
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.issues, [
    { severity: 'warning', code: 'business-rule', diagnostics: undefined, location: [] },
    { severity: 'error', code: 'invalid', diagnostics: undefined, location: ['Patient.gender'] }
  ]);
});

test('validateResource rejects invalid validator JSON', async () => {
  await assert.rejects(
    () => validateResource({ resourceType: 'Patient' }, 'https://example.test/profile', async () => response('not json')),
    ValidatorError
  );
});

test('validateResource rejects valid JSON that is not an OperationOutcome', async () => {
  for (const body of [
    { resourceType: 'Patient' },
    { resourceType: 'Bundle', entry: [] },
    { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Patient' } }] }
  ]) {
    await assert.rejects(
      () => validateResource({ resourceType: 'Patient' }, 'https://example.test/profile', async () => response(JSON.stringify(body))),
      ValidatorError
    );
  }
});

test('validateResource rejects an OperationOutcome missing issue', async () => {
  await assert.rejects(
    () => validateResource({ resourceType: 'Patient' }, 'https://example.test/profile', async () => response(JSON.stringify({
      resourceType: 'OperationOutcome'
    }))),
    ValidatorError
  );
});

test('validateResource rejects an OperationOutcome with no issues', async () => {
  await assert.rejects(
    () => validateResource({ resourceType: 'Patient' }, 'https://example.test/profile', async () => response(JSON.stringify({
      resourceType: 'OperationOutcome',
      issue: []
    }))),
    ValidatorError
  );
});

test('validateResource wraps response body read failures', async () => {
  await assert.rejects(
    () => validateResource({ resourceType: 'Patient' }, 'https://example.test/profile', async () => ({
      ok: true,
      status: 200,
      text: async () => { throw new Error('socket closed'); }
    } as unknown as Response)),
    (error: unknown) => error instanceof ValidatorError && /socket closed/.test(error.message)
  );
});

test('validateResource reports non-success validator responses', async () => {
  await assert.rejects(
    () => validateResource({ resourceType: 'Patient' }, 'https://example.test/profile', async () => response('unavailable', false, 503)),
    (error: unknown) => error instanceof ValidatorError && /503: unavailable/.test(error.message)
  );
});

test('profile wrappers use their respective profile URLs', async () => {
  const urls: string[] = [];
  const fetcher = async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return response(JSON.stringify({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'information', code: 'informational' }]
    }));
  };

  await validatePatient({ resourceType: 'Patient' }, fetcher);
  await validateEncounter({ resourceType: 'Encounter' }, fetcher);

  assert.match(urls[0], /np-core-patient/);
  assert.match(urls[1], /np-core-encounter/);
});
