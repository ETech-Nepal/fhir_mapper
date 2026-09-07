export interface Identifier {
  use?: string;
  system?: string;
  value?: string;
  type?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
}

export interface Coding {
  system?: string;
  code?: string;
  display?: string;
}

export interface Telecom {
  system?: string;
  value?: string;
  use?: string;
  rank?: number;
  period?: { start?: string; end?: string };
}

export interface Address {
  use?: string;
  type?: string;
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  extension?: Array<{ url: string; valueCoding?: Coding; extension?: Array<{ url: string; valueDecimal: number }> }>;
}

export interface Patient {
  resourceType: 'Patient';
  meta?: { profile?: string[] };
  identifier?: Identifier[];
  active?: boolean;
  name?: Array<{ use?: string; family?: string; given?: string[] }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  _birthDate?: { extension: Array<{ url: string; valueString: string }> };
  telecom?: Telecom[];
  address?: Address[];
  extension?: Array<{ url: string; valueCoding?: Coding }>;
}

export interface Encounter {
  resourceType: 'Encounter';
  meta?: { profile?: string[] };
  identifier?: Identifier[];
  status?: string;
  class?: { system?: string; code?: string };
  subject?: { reference: string };
  period?: { start?: string };
}

export interface OperationOutcomeIssue {
  severity: string;
  code: string;
  diagnostics?: string;
  location?: string[];
}

export interface OperationOutcome {
  resourceType: 'OperationOutcome';
  issue?: OperationOutcomeIssue[];
}

export interface ValidationResult {
  valid: boolean;
  issues: OperationOutcomeIssue[];
}
