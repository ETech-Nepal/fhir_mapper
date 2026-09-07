export class MappingError extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
    this.name = 'MappingError';
  }
}
