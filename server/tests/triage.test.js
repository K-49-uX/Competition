import { describe, it, expect } from 'vitest';
import {
  SEVERITY_ORDER,
  RED_FLAG_SYMPTOMS,
  suggestSeverityFromSymptoms,
} from '../src/models/Appointment.js';

describe('triage severity helpers', () => {
  it('exposes a strictly ordered severity ladder', () => {
    expect(SEVERITY_ORDER.none).toBeLessThan(SEVERITY_ORDER.low);
    expect(SEVERITY_ORDER.low).toBeLessThan(SEVERITY_ORDER.moderate);
    expect(SEVERITY_ORDER.moderate).toBeLessThan(SEVERITY_ORDER.high);
    expect(SEVERITY_ORDER.high).toBeLessThan(SEVERITY_ORDER.critical);
  });

  it('publishes the red-flag catalogue used by the booking UI', () => {
    expect(Object.keys(RED_FLAG_SYMPTOMS).length).toBeGreaterThanOrEqual(10);
    for (const v of Object.values(RED_FLAG_SYMPTOMS)) {
      expect(SEVERITY_ORDER[v]).toBeGreaterThan(0);
    }
  });

  it('returns "none" for empty input', () => {
    expect(suggestSeverityFromSymptoms()).toBe('none');
    expect(suggestSeverityFromSymptoms([])).toBe('none');
  });

  it('picks the highest severity when multiple symptoms are reported', () => {
    expect(suggestSeverityFromSymptoms(['vomiting_diarrhea', 'chest_pain'])).toBe('high');
    expect(suggestSeverityFromSymptoms(['severe_pain', 'unconscious'])).toBe('critical');
  });

  it('ignores unknown symptoms instead of throwing', () => {
    expect(suggestSeverityFromSymptoms(['fictitious', 'chest_pain'])).toBe('high');
    expect(suggestSeverityFromSymptoms(['fictitious'])).toBe('none');
  });
});
