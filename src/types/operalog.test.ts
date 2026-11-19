import { describe, expect, it } from 'vitest';
import { parseAdminEditedFields } from './operalog';

describe('parseAdminEditedFields', () => {
  it('parses comma-separated strings and filters invalid field names', () => {
    expect(parseAdminEditedFields('celular, horario , invalid_col, CELULAR')).toEqual([
      'celular',
      'horario',
    ]);
  });

  it('normalizes array inputs and handles null/undefined/empty values', () => {
    expect(parseAdminEditedFields(['nombres', 'celular', 'nombres'])).toEqual([
      'nombres',
      'celular',
    ]);
    expect(parseAdminEditedFields(null)).toEqual([]);
    expect(parseAdminEditedFields('')).toEqual([]);
  });
});
