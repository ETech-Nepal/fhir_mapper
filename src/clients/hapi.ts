const HAPI_BASE_URL = environment('HAPI_BASE_URL') || 'http://hapi-fhir:8080/fhir';
const NATIONAL_ID_SYSTEM = 'http://donidcr.gov.np';

export class HapiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HapiError';
  }
}

export class HapiPatientNotFoundError extends HapiError {
  constructor(message: string) {
    super(message);
    this.name = 'HapiPatientNotFoundError';
  }
}

export async function findPatientReference(nationalId: string, fetcher: typeof fetch = fetch): Promise<string> {
  const url = `${HAPI_BASE_URL}/Patient?identifier=${encodeURIComponent(`${NATIONAL_ID_SYSTEM}|${nationalId}`)}`;
  let response: Response;
  try {
    response = await fetcher(url, { headers: { Accept: 'application/fhir+json' } });
  } catch (error) {
    throw new HapiError(`failed to reach HAPI server: ${errorMessage(error)}`);
  }

  if (!response.ok) throw new HapiError(`HAPI server returned ${response.status}`);

  let bundle: unknown;
  try {
    bundle = await response.json();
  } catch {
    throw new HapiError('HAPI server returned invalid JSON');
  }

  if (!isBundle(bundle)) throw new HapiError('HAPI server returned an invalid search Bundle');
  if (!bundle.entry?.length) throw new HapiPatientNotFoundError(`no Patient found for nationalId ${nationalId}`);

  const firstEntry = bundle.entry[0];
  if (!isPatientEntry(firstEntry)) throw new HapiError('HAPI server returned an invalid Patient search entry');
  return `Patient/${firstEntry.resource.id}`;
}

function isBundle(value: unknown): value is { resourceType: 'Bundle'; entry?: unknown[] } {
  return isRecord(value)
    && value.resourceType === 'Bundle'
    && (value.entry === undefined || Array.isArray(value.entry));
}

function isPatientEntry(value: unknown): value is { resource: { resourceType: 'Patient'; id: string } } {
  return isRecord(value)
    && isRecord(value.resource)
    && value.resource.resourceType === 'Patient'
    && typeof value.resource.id === 'string'
    && value.resource.id.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function environment(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}
