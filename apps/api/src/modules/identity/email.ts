/** O e-mail como o banco o guarda: em minúsculas e sem espaços nas pontas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Se o e-mail, já normalizado, tem a forma de um e-mail. */
export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(email);
}
