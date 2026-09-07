import type { OperationOutcomeIssue, ValidationResult } from '../shared/fhir.js';

const VALIDATOR_URL = environment('VALIDATOR_URL') || 'http://127.0.0.1:8081/validateResource';
const PATIENT_PROFILE_URL = 'http://fhir.digitalhealth.gov.np/core/StructureDefinition/np-core-patient';
const ENCOUNTER_PROFILE_URL = 'http://fhir.digitalhealth.gov.np/core/StructureDefinition/np-core-encounter';

export class ValidatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidatorError';
  }
}

export function extractIssues(outcome: unknown): ValidationResult {
  const outcomes = isBundle(outcome) ? outcome.entry.map((entry) => entry.resource) : [outcome];
  if (!outcomes.every(isOperationOutcome)) {
    throw new ValidatorError('validator output was not an OperationOutcome or Bundle of OperationOutcomes');
  }
  const issues = outcomes.flatMap(extractOutcomeIssues);
  return { valid: !issues.some((issue) => issue.severity === 'error' || issue.severity === 'fatal'), issues };
}

export async function validateResource(
  resource: object,
  profileUrl: string,
  fetcher: typeof fetch = fetch
): Promise<ValidationResult> {
  const url = `${VALIDATOR_URL}?profile=${encodeURIComponent(profileUrl)}`;
  let response: Response;
  try {
    response = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resource)
    });
  } catch (error) {
    throw new ValidatorError(`failed to reach validator server: ${errorMessage(error)}`);
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch (error) {
    throw new ValidatorError(`failed to read validator response: ${errorMessage(error)}`);
  }
  if (!response.ok) throw new ValidatorError(`validator server returned ${response.status}: ${raw.slice(0, 500)}`);

  try {
    return extractIssues(JSON.parse(raw));
  } catch (error) {
    if (error instanceof ValidatorError) throw error;
    throw new ValidatorError('validator output was not valid JSON');
  }
}

export const validatePatient = (resource: object, fetcher?: typeof fetch) =>
  validateResource(resource, PATIENT_PROFILE_URL, fetcher);

export const validateEncounter = (resource: object, fetcher?: typeof fetch) =>
  validateResource(resource, ENCOUNTER_PROFILE_URL, fetcher);

function extractOutcomeIssues(outcome: unknown): OperationOutcomeIssue[] {
  if (!isOperationOutcome(outcome)) return [];
  return outcome.issue.flatMap((issue) => {
    const details = isRecord(issue.details) && typeof issue.details.text === 'string' ? issue.details.text : undefined;
    const location = arrayOfStrings(issue.expression) ?? arrayOfStrings(issue.location) ?? [];
    return [{ severity: issue.severity, code: issue.code, diagnostics: stringOrUndefined(issue.diagnostics) ?? details, location }];
  });
}

function isOperationOutcome(value: unknown): value is { resourceType: 'OperationOutcome'; issue: Array<Record<string, unknown> & { severity: string; code: string }> } {
  return isRecord(value)
    && value.resourceType === 'OperationOutcome'
    && Array.isArray(value.issue)
    && value.issue.length > 0
    && value.issue.every((issue) =>
      isRecord(issue) && typeof issue.severity === 'string' && typeof issue.code === 'string');
}

function isBundle(value: unknown): value is { resourceType: 'Bundle'; entry: Array<{ resource: unknown }> } {
  return isRecord(value)
    && value.resourceType === 'Bundle'
    && Array.isArray(value.entry)
    && value.entry.length > 0
    && value.entry.every((entry) => isRecord(entry) && 'resource' in entry);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function arrayOfStrings(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function environment(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}
