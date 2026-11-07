/** After a failed validation renders, move focus to the first invalid field. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  // A zero-delay timeout runs after React commits the error state (and, unlike
  // requestAnimationFrame, also runs while the tab is in the background).
  window.setTimeout(() => {
    const field = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.focus();
  }, 0);
}
