// Password managers (1Password, LastPass, Bitwarden) offer to fill or save
// on any field of a form that also holds a password-type input, and they
// ignore autocomplete="off". Spread this on every field that is not a real
// login or own-password field so they leave it alone.
export const noAutofill = {
  autoComplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;
