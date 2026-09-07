import assert from 'node:assert/strict';
import test from 'node:test';
import { MappingError } from '../../src/shared/errors.js';

test('MappingError retains the invalid field', () => {
  const error = new MappingError('name', 'name is required');
  assert.equal(error.name, 'MappingError');
  assert.equal(error.field, 'name');
});
