import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPOLOGIA_LABELS, TIPOLOGIA_STYLES } from '../../src/types/index.ts';
test('EE + GN has a shared label and badge styling for forms, filters and cards', () => {
  assert.equal(TIPOLOGIA_LABELS.ee_gas, 'EE + GN');
  assert.ok(TIPOLOGIA_STYLES.ee_gas?.color);
});
const { leadClientSegmentSchema, getLeadClientSegment, withLeadClientSegment } = await import('../../src/lib/lead-classification.ts');
test('all three segments persist and edits preserve CPE and tracking data', () => {
  const data = { cpes: ['PTTEST'], utm_source: 'campaign' };
  for (const segment of ['prata', 'bronze', 'ouro']) {
    const saved = withLeadClientSegment(data, leadClientSegmentSchema.parse(segment));
    assert.equal(getLeadClientSegment(JSON.parse(JSON.stringify(saved))), segment);
    assert.deepEqual(saved.cpes, data.cpes);
    assert.equal(saved.utm_source, data.utm_source);
  }
});
test('legacy leads have no invented segment and invalid values cannot be selected', () => {
  assert.equal(getLeadClientSegment(undefined), undefined);
  assert.equal(getLeadClientSegment({ client_segment: 'unknown' }), undefined);
  assert.equal(leadClientSegmentSchema.safeParse('unknown').success, false);
  assert.deepEqual(withLeadClientSegment({ client_segment: 'bronze', cpes: ['PTTEST'] }, 'ouro'), { client_segment: 'ouro', cpes: ['PTTEST'] });
});
