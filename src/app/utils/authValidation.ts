/**
 * Auth Validation Utilities
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure functions – no external deps, easily unit-testable.
 * Used by the LoginScreen form; can be reused in any future auth screens.
 */

// ─── Individual Validators ───────────────────────────────────────────────────

/**
 * Returns an error string if the email is invalid, or undefined if valid.
 *
 * Rules:
 *  - Must not be empty
 *  - Must match a basic email pattern (RFC-5321 simplified)
 */
export function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Email address is required';
  // Simplified RFC-5321: local@domain.tld
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!EMAIL_RE.test(trimmed)) return 'Enter a valid email address';
  return undefined;
}

/**
 * Returns an error string if the password is invalid, or undefined if valid.
 *
 * Rules:
 *  - Must not be empty
 *  - Minimum 6 characters
 */
export function validatePassword(value: string): string | undefined {
  if (!value) return 'Password is required';
  if (value.length < 6) return 'Password must be at least 6 characters';
  return undefined;
}

// ─── Form-level Validator ────────────────────────────────────────────────────

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface LoginFormErrors {
  email?: string;
  password?: string;
}

/**
 * Validates both fields at once. Returns an errors object (empty = valid).
 */
export function validateLoginForm(values: LoginFormValues): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const emailError = validateEmail(values.email);
  const passwordError = validatePassword(values.password);
  if (emailError) errors.email = emailError;
  if (passwordError) errors.password = passwordError;
  return errors;
}

/** Returns true when the form has no validation errors. */
export function isLoginFormValid(values: LoginFormValues): boolean {
  return Object.keys(validateLoginForm(values)).length === 0;
}

// ─── Mini Test Suite (runs in DEV, logs to console) ─────────────────────────

/**
 * Call runAuthValidationTests() in a dev environment to verify the validators.
 * This is a lightweight alternative to a full test framework.
 *
 * Usage:  import { runAuthValidationTests } from '@/app/utils/authValidation';
 *         runAuthValidationTests(); // call once at app bootstrap in dev
 */
export function runAuthValidationTests(): void {
  const pass = (label: string) => console.log(`  ✅  ${label}`);
  const fail = (label: string, got: unknown) =>
    console.error(`  ❌  ${label} — got: ${JSON.stringify(got)}`);

  console.group('🧪 authValidation tests');

  // validateEmail
  const emailTests: Array<[string, string | undefined]> = [
    ['', 'Email address is required'],
    ['   ', 'Email address is required'],
    ['notanemail', 'Enter a valid email address'],
    ['missing@tld', 'Enter a valid email address'],
    ['valid@email.com', undefined],
    ['user+tag@sub.domain.io', undefined],
  ];
  emailTests.forEach(([input, expected]) => {
    const result = validateEmail(input);
    result === expected
      ? pass(`validateEmail("${input}")`)
      : fail(`validateEmail("${input}") expected ${expected}`, result);
  });

  // validatePassword
  const pwTests: Array<[string, string | undefined]> = [
    ['', 'Password is required'],
    ['12345', 'Password must be at least 6 characters'],
    ['123456', undefined],
    ['supersecure', undefined],
  ];
  pwTests.forEach(([input, expected]) => {
    const result = validatePassword(input);
    result === expected
      ? pass(`validatePassword("${input}")`)
      : fail(`validatePassword("${input}") expected ${expected}`, result);
  });

  // isLoginFormValid
  const formTests: Array<[LoginFormValues, boolean]> = [
    [{ email: '', password: '' }, false],
    [{ email: 'bad', password: 'demo123' }, false],
    [{ email: 'valid@test.com', password: '12345' }, false],
    [{ email: 'valid@test.com', password: 'demo123' }, true],
  ];
  formTests.forEach(([values, expected]) => {
    const result = isLoginFormValid(values);
    result === expected
      ? pass(`isLoginFormValid({ email: "${values.email}", password: "${values.password}" })`)
      : fail(
          `isLoginFormValid({ email: "${values.email}", password: "${values.password}" })`,
          result
        );
  });

  console.groupEnd();
}
