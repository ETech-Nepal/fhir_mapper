import assert from 'node:assert/strict';
import test from 'node:test';
import { mapEncounter } from '../../src/resources/encounter/mapper.js';
import { MappingError } from '../../src/shared/errors.js';

const input = {
  encounterId: 'ENC-123',
  facilityNhfrCode: '00XX',
  status: 'finished',
  classCode: 'AMB',
  start: '2026-09-03T10:30:00+05:45'
};

test('maps the supported Encounter fields', () => {
  assert.deepEqual(mapEncounter(input, 'Patient/123'), {
    resourceType: 'Encounter',
    meta: { profile: ['http://fhir.digitalhealth.gov.np/core/StructureDefinition/np-core-encounter'] },
    identifier: [{ use: 'official', system: 'http://nhfr.digitalhealth.gov.np/00XX', value: 'ENC-123' }],
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    subject: { reference: 'Patient/123' },
    period: { start: '2026-09-03T10:30:00+05:45' }
  });
});

test('rejects blank required fields and invalid facility code', () => {
  for (const field of ['encounterId', 'facilityNhfrCode', 'status', 'classCode', 'start']) {
    assert.throws(() => mapEncounter({ ...input, [field]: ' ' }, 'Patient/123'),
      (error: unknown) => error instanceof MappingError && error.field === field);
  }
  assert.throws(() => mapEncounter({ ...input, facilityNhfrCode: 'facility/one' }, 'Patient/123'),
    (error: unknown) => error instanceof MappingError && error.field === 'facilityNhfrCode');
});

test('rejects date-times without a timezone or with an invalid date', () => {
  for (const start of ['2026-09-03T10:30:00', 'not-a-date', '2026-02-30T10:30:00Z', '2026-09-03T24:00:00Z']) {
    assert.throws(() => mapEncounter({ ...input, start }, 'Patient/123'),
      (error: unknown) => error instanceof MappingError && error.field === 'start');
  }
});

test('rejects references other than Patient/{id}', () => {
  for (const reference of ['', 'Observation/123', 'Patient/', 'Patient/a/b', ' patient/123']) {
    assert.throws(() => mapEncounter(input, reference),
      (error: unknown) => error instanceof MappingError && error.field === 'patientReference');
  }
});
