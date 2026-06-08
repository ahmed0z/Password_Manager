// ============================================================================
// VaultSync — Authentication Module
// Handles sign-up, sign-in, sign-out, and vault key recovery.
// The master password is NEVER sent to Supabase — only a derived auth key.
// ============================================================================

import { getSupabaseClient } from './client';
import {
  generateSalt,
  deriveVaultKey,
  deriveAuthKey,
  createRecoveryKey,
  recoverVaultKey as recoverVaultKeyFromBlob,
} from '../crypto/vault-key';
import type {
  UserProfile,
  VaultKeyMaterial,
  SignUpInput,
  SignInInput,
} from '../types';

/**
 * Registers a new user.
 *
 * Flow:
 * 1. Generate unique salts for auth and vault key derivation
 * 2. Derive auth key (used as Supabase password — NOT the master password)
 * 3. Derive vault key (used for encryption — never sent to server)
 * 4. Create encrypted recovery key blob
 * 5. Sign up with Supabase auth using derived auth key
 * 6. Store salts and recovery blob in profiles table
 * 7. Return vault key material for immediate use
 */
export async function signUp(
  input: SignUpInput
): Promise<{ profile: UserProfile; vaultKey: VaultKeyMaterial }> {
  const supabase = getSupabaseClient();

  // Step 1: Generate unique salts
  const authSalt = generateSalt();
  const vaultSalt = generateSalt();

  // Step 2: Derive auth key (this becomes the Supabase password)
  const authKey = await deriveAuthKey(input.masterPassword, authSalt);

  // Step 3: Derive vault key (never leaves the device)
  const vaultKey = await deriveVaultKey(input.masterPassword, vaultSalt);

  // Step 4: Create recovery key (encrypted vault key, recoverable via email + master password)
  const recovery = await createRecoveryKey(
    vaultKey,
    input.email,
    input.masterPassword
  );

  // Step 5: Sign up with Supabase auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: authKey,
  });

  if (authError || !authData.user) {
    throw new Error(`Sign-up failed: ${authError?.message || 'Unknown error'}`);
  }

  // Step 6: Store salts and recovery blob in profiles table
  const profile: Omit<UserProfile, 'created_at' | 'updated_at'> = {
    id: authData.user.id,
    email: input.email,
    encrypted_vault_salt: vaultSalt,
    auth_salt: authSalt,
    encrypted_recovery_key: recovery.encryptedRecoveryKey,
    recovery_iv: recovery.recoveryIv,
    recovery_salt: recovery.recoverySalt,
  };

  const { error: profileError } = await supabase
    .from('profiles')
    .insert(profile);

  if (profileError) {
    throw new Error(`Profile creation failed: ${profileError.message}`);
  }

  return {
    profile: profile as UserProfile,
    vaultKey: { key: vaultKey, salt: vaultSalt },
  };
}

/**
 * Signs in an existing user.
 *
 * Flow:
 * 1. Fetch the user's profile to get salts
 * 2. Derive auth key from master password + auth salt
 * 3. Sign in with Supabase auth
 * 4. Derive vault key from master password + vault salt
 * 5. Return vault key material
 */
export async function signIn(
  input: SignInInput
): Promise<{ profile: UserProfile; vaultKey: VaultKeyMaterial }> {
  const supabase = getSupabaseClient();

  // Step 1: Fetch profile to get salts
  // We need to sign in first to access RLS-protected data, but we need the salt to derive the auth key.
  // Solution: Store auth_salt in a public lookup or use email-based lookup before auth.
  // For security, we use a server function that returns only the salts given an email.
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('auth_salt, encrypted_vault_salt, id, email, encrypted_recovery_key, recovery_iv, recovery_salt, created_at, updated_at')
    .eq('email', input.email)
    .single();

  if (profileError || !profileData) {
    throw new Error('Account not found. Please check your email.');
  }

  // Step 2: Derive auth key
  const authKey = await deriveAuthKey(input.masterPassword, profileData.auth_salt);

  // Step 3: Sign in with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: authKey,
  });

  if (authError || !authData.user) {
    throw new Error('Invalid master password. Please try again.');
  }

  // Step 4: Derive vault key
  const vaultKey = await deriveVaultKey(
    input.masterPassword,
    profileData.encrypted_vault_salt
  );

  return {
    profile: profileData as UserProfile,
    vaultKey: { key: vaultKey, salt: profileData.encrypted_vault_salt },
  };
}

/**
 * Signs out the current user and clears the session.
 */
export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(`Sign-out failed: ${error.message}`);
  }
}

/**
 * Gets the current authenticated session (if any).
 */
export async function getSession() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

/**
 * Listens for auth state changes.
 */
export function onAuthStateChange(
  callback: (event: string, session: unknown) => void
) {
  const supabase = getSupabaseClient();
  return supabase.auth.onAuthStateChange(callback);
}

/**
 * Recovers the vault key using email confirmation.
 * The user must have verified their email OTP before calling this.
 *
 * @param email - User's email
 * @param masterPassword - The recovery password (same as master password during signup)
 */
export async function recoverUserVaultKey(
  email: string,
  recoveryPassword: string
): Promise<VaultKeyMaterial> {
  const supabase = getSupabaseClient();

  // Fetch recovery data
  const { data, error } = await supabase
    .from('profiles')
    .select('encrypted_recovery_key, recovery_iv, recovery_salt, encrypted_vault_salt')
    .eq('email', email)
    .single();

  if (error || !data) {
    throw new Error('Profile not found for recovery.');
  }

  if (!data.encrypted_recovery_key || !data.recovery_iv || !data.recovery_salt) {
    throw new Error('No recovery key set up for this account.');
  }

  const vaultKey = await recoverVaultKeyFromBlob(
    data.encrypted_recovery_key,
    data.recovery_iv,
    data.recovery_salt,
    email,
    recoveryPassword
  );

  return { key: vaultKey, salt: data.encrypted_vault_salt };
}

/**
 * Initiates password reset by sending an OTP to the user's email.
 */
export async function sendRecoveryEmail(email: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/recover`,
  });
  if (error) {
    throw new Error(`Failed to send recovery email: ${error.message}`);
  }
}
