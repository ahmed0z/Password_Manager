// ============================================================================
// VaultSync — Cryptographically Secure Password Generator
// Uses crypto.getRandomValues for true randomness.
// ============================================================================

import type { PasswordGeneratorOptions, PasswordStrength } from '../types';

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const AMBIGUOUS = 'O0l1I';

const DEFAULT_OPTIONS: PasswordGeneratorOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

/**
 * Generates a cryptographically secure random password.
 */
export function generatePassword(
  options: Partial<PasswordGeneratorOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Build character pool
  let pool = '';
  const required: string[] = [];

  if (opts.uppercase) {
    let chars = UPPERCASE;
    if (opts.excludeAmbiguous) chars = chars.replace(/[OI]/g, '');
    pool += chars;
    required.push(chars);
  }
  if (opts.lowercase) {
    let chars = LOWERCASE;
    if (opts.excludeAmbiguous) chars = chars.replace(/[l]/g, '');
    pool += chars;
    required.push(chars);
  }
  if (opts.digits) {
    let chars = DIGITS;
    if (opts.excludeAmbiguous) chars = chars.replace(/[01]/g, '');
    pool += chars;
    required.push(chars);
  }
  if (opts.symbols) {
    const chars = opts.customSymbols || SYMBOLS;
    pool += chars;
    required.push(chars);
  }

  if (pool.length === 0) {
    pool = LOWERCASE + DIGITS;
  }

  // Generate password ensuring at least one char from each required set
  const password = new Array(opts.length);
  const randomValues = new Uint32Array(opts.length);
  crypto.getRandomValues(randomValues);

  // Fill required character positions first
  for (let i = 0; i < Math.min(required.length, opts.length); i++) {
    const charSet = required[i];
    password[i] = charSet[randomValues[i] % charSet.length];
  }

  // Fill remaining positions from full pool
  for (let i = required.length; i < opts.length; i++) {
    password[i] = pool[randomValues[i] % pool.length];
  }

  // Shuffle using Fisher-Yates
  const shuffleRandom = new Uint32Array(opts.length);
  crypto.getRandomValues(shuffleRandom);
  for (let i = opts.length - 1; i > 0; i--) {
    const j = shuffleRandom[i] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}

/**
 * Estimates password strength based on entropy.
 */
export function estimateStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: 'No Password', entropy: 0, crackTime: 'instant' };
  }

  // Calculate character pool size
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

  // Entropy = length * log2(pool size)
  const entropy = password.length * Math.log2(Math.max(poolSize, 1));

  // Determine score
  let score: 0 | 1 | 2 | 3 | 4;
  let label: string;
  let crackTime: string;

  if (entropy < 28) {
    score = 0;
    label = 'Very Weak';
    crackTime = 'seconds';
  } else if (entropy < 36) {
    score = 1;
    label = 'Weak';
    crackTime = 'minutes to hours';
  } else if (entropy < 60) {
    score = 2;
    label = 'Fair';
    crackTime = 'days to months';
  } else if (entropy < 80) {
    score = 3;
    label = 'Strong';
    crackTime = 'years';
  } else {
    score = 4;
    label = 'Very Strong';
    crackTime = 'centuries+';
  }

  return { score, label, entropy: Math.round(entropy), crackTime };
}

export { DEFAULT_OPTIONS as defaultGeneratorOptions };
