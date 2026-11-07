/**
 * Text for the total company-feedback badge on the student dashboard.
 * Returns null when there is nothing to show (unknown, zero or invalid count).
 * This is a total, not an unread count.
 */
export function feedbackBadgeText(
  total: number | null | undefined,
): { visible: string; accessible: string } | null {
  if (typeof total !== 'number' || !Number.isInteger(total) || total <= 0) return null;
  return {
    visible: total > 99 ? '99+' : String(total),
    accessible: total === 1 ? '1 feedback message' : `${total} feedback messages`,
  };
}
