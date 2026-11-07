import { describe, expect, it } from 'vitest';
import { feedbackBadgeText } from './feedbackBadge';

describe('feedbackBadgeText', () => {
  it('hides the badge when there is no feedback or the count is unknown', () => {
    expect(feedbackBadgeText(0)).toBeNull();
    expect(feedbackBadgeText(undefined)).toBeNull();
    expect(feedbackBadgeText(null)).toBeNull();
    expect(feedbackBadgeText(-1)).toBeNull();
  });

  it('shows the total with singular and plural accessible text', () => {
    expect(feedbackBadgeText(1)).toEqual({ visible: '1', accessible: '1 feedback message' });
    expect(feedbackBadgeText(3)).toEqual({ visible: '3', accessible: '3 feedback messages' });
  });

  it('caps very large totals visually but keeps the exact accessible count', () => {
    expect(feedbackBadgeText(150)).toEqual({ visible: '99+', accessible: '150 feedback messages' });
  });
});
