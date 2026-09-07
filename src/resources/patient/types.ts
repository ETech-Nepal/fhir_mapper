import type { Address, Patient, Telecom } from '../../shared/fhir.js';

export interface PatientInput {
  name: string;
  gender?: NonNullable<Patient['gender']>;
  dob?: string;
  nationalId?: string;
  healthId: string;
  active?: boolean;
  phoneNumber?: string;
  telecom?: Telecom[];
  casteEthnicityCode?: string;
  citizenshipNumber?: string;
  healthInsuranceId?: string;
  passportNumber?: string;
  ssfNumber?: string;
  bikramSambatDob?: string;
  address?: Array<Address & { provinceCode?: string; districtCode?: string; localLevelCode?: string; latitude?: number; longitude?: number }>;
}
