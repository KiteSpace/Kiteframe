import { describe, expect, it } from 'vitest';
import { normalizeGeneratedPrdSection } from '../prdMarkdown';

describe('normalizeGeneratedPrdSection', () => {
  it('removes an opening ATX heading that repeats the section title', () => {
    expect(normalizeGeneratedPrdSection(
      '## Failure Scenarios\n\n- **Invalid configuration**: Explain the correction path.',
      'Failure Scenarios',
    )).toBe('- **Invalid configuration**: Explain the correction path.');
  });

  it('matches heading formatting, case, and whitespace without removing content', () => {
    expect(normalizeGeneratedPrdSection(
      '### **  OPERATIONAL   RISKS  ** ###\n\n- Monitor dependency latency.',
      'Operational Risks',
    )).toBe('- Monitor dependency latency.');
  });

  it('removes a repeated setext heading', () => {
    expect(normalizeGeneratedPrdSection(
      'User Flow\n---------\n\n1. Start the workflow.',
      'User Flow',
    )).toBe('1. Start the workflow.');
  });

  it('preserves meaningful inner headings for a compound section', () => {
    const content = '## Inputs\n\n- Asset identifier\n\n## Outputs\n\n- Reservation status';

    expect(normalizeGeneratedPrdSection(content, 'Inputs & Outputs')).toBe(content);
  });

  it('preserves a leading heading with a different title', () => {
    const content = '## Failure handling\n\n- Retry transient errors.';

    expect(normalizeGeneratedPrdSection(content, 'Failure Scenarios')).toBe(content);
  });
});