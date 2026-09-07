import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPatient } from '../../src/resources/patient/mapper.js';
import { MappingError } from '../../src/shared/errors.js';

const input = {
  name: 'Anita Maharjan',
  gender: 'female',
  dob: '1995-08-22',
  nationalId: '2345-6789-0123-4',
  healthId: '10000000003'
};

test('maps a Patient with both NP Core identifiers', () => {
  const patient = mapPatient(input);
  assert.equal(patient.resourceType, 'Patient');
  assert.deepEqual(patient.meta, {
    profile: ['http://fhir.digitalhealth.gov.np/core/StructureDefinition/np-core-patient']
  });
  assert.equal(patient.identifier?.length, 2);
  assert.equal(patient.identifier?.[0].value, '2345-6789-0123-4');
  assert.equal(patient.identifier?.[0].type?.coding?.[0].code, 'NI');
  assert.equal(patient.identifier?.[1].value, '10000000003');
  assert.equal(patient.identifier?.[1].type?.coding?.[0].code, 'health-id');
  assert.equal(patient.active, true);
  assert.deepEqual(patient.name?.[0], { use: 'official', family: 'Maharjan', given: ['Anita'] });
  assert.equal(patient.gender, 'female');
  assert.equal(patient.birthDate, '1995-08-22');
});

test('maps a profile-valid Patient when optional demographics are absent', () => {
  const patient = mapPatient({ name: 'Anita Maharjan', healthId: '10000000003' });
  assert.deepEqual(patient.identifier, [{
    use: 'official',
    type: { coding: [{ system: 'http://fhir.digitalhealth.gov.np/core/CodeSystem/np-core-identifier-type', code: 'health-id', display: 'Nepal Health ID' }] },
    system: 'http://fhir.digitalhealth.gov.np/core/NamingSystem/nepal-health-id',
    value: '10000000003'
  }]);
  assert.equal(patient.gender, undefined);
  assert.equal(patient.birthDate, undefined);
});

test('preserves explicit inactive state and optional telecom and caste extension', () => {
  const patient = mapPatient({ ...input, active: false, phoneNumber: '+977-9800000000', casteEthnicityCode: '2' });
  assert.equal(patient.active, false);
  assert.deepEqual(patient.telecom, [{ system: 'phone', value: '+977-9800000000' }]);
  assert.deepEqual(patient.extension, [{
    url: 'http://fhir.digitalhealth.gov.np/core/StructureDefinition/caste-ethnicity',
    valueCoding: {
      system: 'http://fhir.digitalhealth.gov.np/core/CodeSystem/nepal-caste-ethnicity',
      code: '2'
    }
  }]);
});

test('maps every optional NP Core Patient field when supplied', () => {
  const patient = mapPatient({
    ...input,
    phoneNumber: '+977-9800000000',
    telecom: [{ system: 'email', value: 'anita@example.test', use: 'home', period: { start: '2020-01-01', end: '2030-01-01' } }],
    casteEthnicityCode: '2',
    citizenshipNumber: '12-34-56-78901',
    healthInsuranceId: 'HIB-000123456',
    passportNumber: 'PA1234567',
    ssfNumber: '1-01-01-00001234',
    bikramSambatDob: '2052-05-06',
    address: [{
      use: 'home', type: 'physical', text: 'Ward 1, Changunarayan Municipality, Bhaktapur, Bagmati Province, Nepal',
      line: ['Ward 1'], city: 'Changunarayan Municipality', district: 'Bhaktapur', state: 'Bagmati Province',
      postalCode: '44700', country: 'NP', provinceCode: '3', districtCode: '307', localLevelCode: '30701', latitude: 27.7172, longitude: 85.3240
    }]
  });
  const mapped = patient as typeof patient & { _birthDate?: unknown; address?: unknown };

  assert.deepEqual(patient.identifier?.slice(2), [
    { use: 'official', type: { coding: [{ system: 'http://fhir.digitalhealth.gov.np/core/CodeSystem/np-core-identifier-type', code: 'citizenship-number', display: 'Nepal Citizenship Certificate Number' }] }, system: 'http://moha.gov.np', value: '12-34-56-78901' },
    { use: 'official', type: { coding: [{ system: 'http://fhir.digitalhealth.gov.np/core/CodeSystem/np-core-identifier-type', code: 'health-insurance-id', display: 'Nepal Health Insurance ID' }] }, system: 'http://hib.gov.np', value: 'HIB-000123456' },
    { use: 'official', type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'PPN', display: 'Passport number' }] }, system: 'http://nepalpassport.gov.np', value: 'PA1234567' },
    { use: 'official', type: { coding: [{ system: 'http://fhir.digitalhealth.gov.np/core/CodeSystem/np-core-identifier-type', code: 'ssf-number', display: 'Nepal Social Security Fund Number' }] }, system: 'http://ssf.gov.np', value: '1-01-01-00001234' }
  ]);
  assert.deepEqual(patient.telecom, [
    { system: 'phone', value: '+977-9800000000' },
    { system: 'email', value: 'anita@example.test', use: 'home', period: { start: '2020-01-01', end: '2030-01-01' } }
  ]);
  assert.deepEqual(mapped._birthDate, { extension: [{ url: 'http://fhir.digitalhealth.gov.np/core/StructureDefinition/np-core-bikram-sambat-date', valueString: '2052-05-06' }] });
  assert.deepEqual(mapped.address, [{
    use: 'home', type: 'physical', text: 'Ward 1, Changunarayan Municipality, Bhaktapur, Bagmati Province, Nepal',
    line: ['Ward 1'], city: 'Changunarayan Municipality', district: 'Bhaktapur', state: 'Bagmati Province', postalCode: '44700', country: 'NP',
    extension: [
      { url: 'http://fhir.digitalhealth.gov.np/core/StructureDefinition/ext-nepal-province', valueCoding: { system: 'http://fhir.digitalhealth.gov.np/core/CodeSystem/nepal-administrative-location', code: '3' } },
      { url: 'http://fhir.digitalhealth.gov.np/core/StructureDefinition/ext-nepal-district', valueCoding: { system: 'http://fhir.digitalhealth.gov.np/core/CodeSystem/nepal-administrative-location', code: '307' } },
      { url: 'http://fhir.digitalhealth.gov.np/core/StructureDefinition/ext-nepal-local-level', valueCoding: { system: 'http://fhir.digitalhealth.gov.np/core/CodeSystem/nepal-administrative-location', code: '30701' } },
      { url: 'http://hl7.org/fhir/StructureDefinition/geolocation', extension: [{ url: 'latitude', valueDecimal: 27.7172 }, { url: 'longitude', valueDecimal: 85.3240 }] }
    ]
  }]);
});

test('rejects missing healthId with MappingError', () => {
  assert.throws(
    () => mapPatient({ ...input, healthId: undefined }),
    (error: unknown) => error instanceof MappingError && error.field === 'healthId'
  );
});

test('splits one-word and multi-word names using the final word as family', () => {
  assert.deepEqual(mapPatient({ ...input, name: 'Cher' }).name?.[0], {
    use: 'official', family: 'Cher', given: ['Cher']
  });
  assert.deepEqual(mapPatient({ ...input, name: 'Ram Bahadur Thapa' }).name?.[0], {
    use: 'official', family: 'Thapa', given: ['Ram', 'Bahadur']
  });
});

test('rejects invalid supplied demographics', () => {
  for (const [field, value] of [['name', ' '], ['nationalId', ''], ['gender', 'x'], ['dob', '22-08-1995']] as const) {
    assert.throws(
      () => mapPatient({ ...input, [field]: value }),
      (error: unknown) => error instanceof MappingError && error.field === field
    );
  }
});

test('rejects impossible calendar dates', () => {
  for (const dob of ['2025-02-29', '2024-02-30', '1995-13-01', '1995-00-10']) {
    assert.throws(
      () => mapPatient({ ...input, dob }),
      (error: unknown) => error instanceof MappingError && error.field === 'dob'
    );
  }
  assert.equal(mapPatient({ ...input, dob: '2024-02-29' }).birthDate, '2024-02-29');
});

test('rejects non-boolean active and non-string optional fields', () => {
  for (const [field, value] of [['active', 'false'], ['phoneNumber', 9800000000], ['casteEthnicityCode', 2]] as const) {
    assert.throws(
      () => mapPatient({ ...input, [field]: value }),
      (error: unknown) => error instanceof MappingError && error.field === field
    );
  }
});
