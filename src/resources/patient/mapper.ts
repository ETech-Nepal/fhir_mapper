import type { Address, Identifier, Patient, Telecom } from '../../shared/fhir.js';
import { MappingError } from '../../shared/errors.js';
import type { PatientInput } from './types.js';

const GENDERS = new Set<NonNullable<Patient['gender']>>(['male', 'female', 'other', 'unknown']);
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const PATIENT_PROFILE = 'http://fhir.digitalhealth.gov.np/core/StructureDefinition/np-core-patient';
const NP_CORE = 'http://fhir.digitalhealth.gov.np/core';
const ADDRESS_SYSTEM = `${NP_CORE}/CodeSystem/nepal-administrative-location`;

function requiredString(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (typeof value !== 'string' || !value.trim()) throw new MappingError(field, `${field} is required`);
  return value;
}

function splitName(name: string): { given: string[]; family: string } {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? { given: [parts[0]], family: parts[0] }
    : { given: parts.slice(0, -1), family: parts[parts.length - 1] };
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DOB_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function optionalString(input: Record<string, unknown>, field: string): string | undefined {
  const value = input[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) throw new MappingError(field, `${field} must be a non-empty string`);
  return value;
}

function optionalIdentifier(value: string | undefined, system: string, code: string, display: string): Identifier | undefined {
  if (!value) return undefined;
  return { use: 'official', type: { coding: [{ system: code === 'NI' || code === 'PPN' ? 'http://terminology.hl7.org/CodeSystem/v2-0203' : `${NP_CORE}/CodeSystem/np-core-identifier-type`, code, display }] }, system, value };
}

function mapTelecom(value: unknown): Telecom[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new MappingError('telecom', 'telecom must be an array');
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new MappingError(`telecom[${index}]`, 'telecom entry must be an object');
    const telecom = entry as Record<string, unknown>;
    if (typeof telecom.system !== 'string' || !telecom.system || typeof telecom.value !== 'string' || !telecom.value) {
      throw new MappingError(`telecom[${index}]`, 'telecom entry requires system and value');
    }
    if (telecom.use !== undefined && typeof telecom.use !== 'string') throw new MappingError(`telecom[${index}].use`, 'telecom use must be a string');
    if (telecom.rank !== undefined && (typeof telecom.rank !== 'number' || !Number.isInteger(telecom.rank) || telecom.rank < 1)) throw new MappingError(`telecom[${index}].rank`, 'telecom rank must be a positive integer');
    if (telecom.period !== undefined && (!telecom.period || typeof telecom.period !== 'object' || Array.isArray(telecom.period))) throw new MappingError(`telecom[${index}].period`, 'telecom period must be an object');
    const period = telecom.period as Record<string, unknown> | undefined;
    if (period && ['start', 'end'].some((field) => period[field] !== undefined && typeof period[field] !== 'string')) throw new MappingError(`telecom[${index}].period`, 'telecom period dates must be strings');
    return { system: telecom.system, value: telecom.value, ...(typeof telecom.use === 'string' && { use: telecom.use }), ...(typeof telecom.rank === 'number' && { rank: telecom.rank }), ...(period && { period: { ...(typeof period.start === 'string' && { start: period.start }), ...(typeof period.end === 'string' && { end: period.end }) } }) };
  });
}

function mapAddress(value: unknown): Address[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new MappingError('address', 'address must be an array');
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new MappingError(`address[${index}]`, 'address entry must be an object');
    const address = entry as Record<string, unknown>;
    if (typeof address.country !== 'string' || !address.country) throw new MappingError(`address[${index}].country`, 'address country is required');
    for (const field of ['use', 'type', 'text', 'city', 'district', 'state', 'postalCode', 'provinceCode', 'districtCode', 'localLevelCode']) {
      if (address[field] !== undefined && typeof address[field] !== 'string') throw new MappingError(`address[${index}].${field}`, `address ${field} must be a string`);
    }
    if (address.latitude !== undefined && typeof address.latitude !== 'number' || address.longitude !== undefined && typeof address.longitude !== 'number' || (address.latitude === undefined) !== (address.longitude === undefined)) throw new MappingError(`address[${index}].geolocation`, 'address latitude and longitude must both be numbers');
    if (address.line !== undefined && (!Array.isArray(address.line) || address.line.some((line) => typeof line !== 'string'))) throw new MappingError(`address[${index}].line`, 'address line must be an array of strings');
    const extension: NonNullable<Address['extension']> = [
      ['provinceCode', 'ext-nepal-province'], ['districtCode', 'ext-nepal-district'], ['localLevelCode', 'ext-nepal-local-level']
    ].flatMap(([field, name]) => typeof address[field] === 'string' ? [{ url: `${NP_CORE}/StructureDefinition/${name}`, valueCoding: { system: ADDRESS_SYSTEM, code: address[field] } }] : []);
    if (typeof address.latitude === 'number' && typeof address.longitude === 'number') extension.push({ url: 'http://hl7.org/fhir/StructureDefinition/geolocation', extension: [{ url: 'latitude', valueDecimal: address.latitude }, { url: 'longitude', valueDecimal: address.longitude }] });
    return { ...Object.fromEntries(['use', 'type', 'text', 'city', 'district', 'state', 'postalCode', 'country'].flatMap((field) => typeof address[field] === 'string' ? [[field, address[field]]] : [])), ...(address.line && { line: address.line as string[] }), ...(extension.length && { extension }) };
  });
}

export function mapPatient(input: unknown): Patient {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new MappingError('body', 'request body must be a JSON object');
  }
  const body = input as Record<string, unknown>;
  const name = requiredString(body, 'name');
  const gender = body.gender;
  if (gender !== undefined && (typeof gender !== 'string' || !GENDERS.has(gender as NonNullable<Patient['gender']>))) {
    throw new MappingError('gender', 'gender must be one of male, female, other, unknown');
  }
  const dob = body.dob;
  if (dob !== undefined && !validDate(dob)) {
    throw new MappingError('dob', 'dob must be YYYY-MM-DD');
  }
  const nationalId = optionalString(body, 'nationalId');
  const healthId = requiredString(body, 'healthId');
  const active = body.active;
  if (active !== undefined && typeof active !== 'boolean') throw new MappingError('active', 'active must be a boolean');
  const phoneNumber = optionalString(body, 'phoneNumber');
  const casteEthnicityCode = optionalString(body, 'casteEthnicityCode');
  const telecom = mapTelecom(body.telecom);
  const address = mapAddress(body.address);
  const citizenshipNumber = optionalString(body, 'citizenshipNumber');
  const healthInsuranceId = optionalString(body, 'healthInsuranceId');
  const passportNumber = optionalString(body, 'passportNumber');
  const ssfNumber = optionalString(body, 'ssfNumber');
  const bikramSambatDob = optionalString(body, 'bikramSambatDob');
  if (bikramSambatDob && !/^\d{4}(-\d{2})?(-\d{2})?$/.test(bikramSambatDob)) throw new MappingError('bikramSambatDob', 'bikramSambatDob must be YYYY, YYYY-MM, or YYYY-MM-DD');
  const { given, family } = splitName(name);

  const patient: Patient = {
    resourceType: 'Patient',
    meta: { profile: [PATIENT_PROFILE] },
    identifier: [
      optionalIdentifier(nationalId, 'http://donidcr.gov.np', 'NI', 'National unique individual identifier'),
      {
        use: 'official',
        type: { coding: [{ system: 'http://fhir.digitalhealth.gov.np/core/CodeSystem/np-core-identifier-type', code: 'health-id', display: 'Nepal Health ID' }] },
        system: 'http://fhir.digitalhealth.gov.np/core/NamingSystem/nepal-health-id',
        value: healthId
      },
      optionalIdentifier(citizenshipNumber, 'http://moha.gov.np', 'citizenship-number', 'Nepal Citizenship Certificate Number'),
      optionalIdentifier(healthInsuranceId, 'http://hib.gov.np', 'health-insurance-id', 'Nepal Health Insurance ID'),
      optionalIdentifier(passportNumber, 'http://nepalpassport.gov.np', 'PPN', 'Passport number'),
      optionalIdentifier(ssfNumber, 'http://ssf.gov.np', 'ssf-number', 'Nepal Social Security Fund Number')
    ].filter((identifier): identifier is Identifier => identifier !== undefined),
    active: active ?? true,
    name: [{ use: 'official', family, given }],
    ...(gender && { gender: gender as Patient['gender'] }),
    ...(dob && { birthDate: dob })
  };
  if (phoneNumber || telecom) patient.telecom = [...(phoneNumber ? [{ system: 'phone', value: phoneNumber }] : []), ...(telecom ?? [])];
  if (address) patient.address = address;
  if (bikramSambatDob) patient._birthDate = { extension: [{ url: `${NP_CORE}/StructureDefinition/np-core-bikram-sambat-date`, valueString: bikramSambatDob }] };
  if (casteEthnicityCode) patient.extension = [{
    url: 'http://fhir.digitalhealth.gov.np/core/StructureDefinition/caste-ethnicity',
    valueCoding: { system: 'http://fhir.digitalhealth.gov.np/core/CodeSystem/nepal-caste-ethnicity', code: casteEthnicityCode }
  }];
  return patient;
}

export type { PatientInput };
