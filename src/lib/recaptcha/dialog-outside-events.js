/**
 * Radix modal dialogs disable pointer events on document.body, which blocks
 * reCAPTCHA v2 image challenges rendered outside the dialog. Use with modal={false}
 * on Dialog and these handlers on DialogContent.
 */
export function isRecaptchaPointerTarget(target) {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      'iframe[src*="recaptcha"], iframe[src*="google.com/recaptcha"], .g-recaptcha, [id^="recaptcha"]',
    ),
  );
}

export function preventDialogDismissForRecaptcha(event) {
  if (isRecaptchaPointerTarget(event.target)) {
    event.preventDefault();
  }
}
