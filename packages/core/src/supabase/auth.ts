// ============================================================================
// VaultSync — Authentication Module
// Handles sign-up, sign-in, sign-out, and vault key recovery.
// The master password is NEVER sent to Supabase — only a derived auth key.
// Uses @noble/hashes via vault-key.ts for cross-platform PBKDF2 derivation.
// ============================================================================

import { getSupabaseClient } from './client';
import {
  generateSalt,
  deriveVaultKeyBytes,
  deriveAuthKeyHex,
  createRecoveryKeyBlob,
  recoverVaultKeyBytes,
} from '../crypto/vault-key';
import type {
  UserProfile,
  VaultKeyMaterial,
  SignUpInput,
  SignInInput,
} from '../types';

// ============================================================================
// Sign Up
// ============================================================================

/**
 * Registers a new user.
 *
 * Flow:
 * 1. Generate unique salts for auth and vault key derivation
 * 2. Derive auth key hex (used as Supabase password — NOT the master password)
 * 3. Derive vault key bytes (used for encryption — never sent to server)
 * 4. Create encrypted recovery blob
 * 5. Sign up with Supabase auth using derived auth key
 * 6. Store salts and recovery blob in profiles table
 * 7. Return vault key material for immediate use
 */
export async function signUp(
  input: SignUpInput
): Promise<{ profile: UserProfile; vaultKey: VaultKeyMaterial }> {
  const supabase = getSupabaseClient();

  // Step 1: Generate unique salts (auth and vault use different salts)
  const authSalt = generateSalt();
  const vaultSalt = generateSalt();

  // Step 2: Derive auth key (hex string used as Supabase password)
  const authKeyHex = await deriveAuthKeyHex(input.masterPassword, authSalt);

  // Step 3: Derive vault key (raw bytes, never leaves device)
  const vaultKeyBytes = await deriveVaultKeyBytes(input.masterPassword, vaultSalt);

  // Step 4: Create encrypted recovery blob
  const recovery = await createRecoveryKeyBlob(vaultKeyBytes, input.email, input.masterPassword);

  // Step 5: Register with Supabase auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: authKeyHex,
  });

  if (authError || !authData.user) {
    throw new Error(`Sign-up failed: ${authError?.message || 'Unknown error'}`);
  }

  // Step 6: Store salts + recovery blob in profiles table
  const profile: Omit<UserProfile, 'created_at' | 'updated_at'> = {
    id: authData.user.id,
    email: input.email,
    encrypted_vault_salt: vaultSalt,
    auth_salt: authSalt,
    encrypted_recovery_key: recovery.encryptedRecoveryKey,
    recovery_iv: recovery.recoveryIv,
    recovery_salt: recovery.recoverySalt,
  };

  const { error: profileError } = await supabase.from('profiles').insert(profile);
  if (profileError) {
    throw new Error(`Profile creation failed: ${profileError.message}`);
  }

  return {
    profile: profile as UserProfile,
    vaultKey: { key: vaultKeyBytes, salt: vaultSalt },
  };
}

// ============================================================================
// Sign In
// ============================================================================

/**
 * Signs in an existing user.
 *
 * Flow:
 * 1. Fetch the user's profile to get salts (public read via RLS policy)
 * 2. Derive auth key from master password + auth salt
 * 3. Sign in with Supabase auth using derived auth key
 * 4. Derive vault key from master password + vault salt
 * 5. Return vault key material for immediate use
 *
 * This function works identically on Web, Chrome Extension, and React Native.
 */
export async function signIn(
  input: SignInInput
): Promise<{ profile: UserProfile; vaultKey: VaultKeyMaterial }> {
  const supabase = getSupabaseClient();

  // Step 1: Fetch profile to get salts (unauthenticated read allowed by RLS)
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('auth_salt, encrypted_vault_salt, id, email, encrypted_recovery_key, recovery_iv, recovery_salt, created_at, updated_at')
    .eq('email', input.email)
    .single();

  if (profileError || !profileData) {
    throw new Error('Account not found. Please check your email.');
  }

  // Step 2: Derive auth key (same algorithm as signup — guaranteed identical output)
  const authKeyHex = await deriveAuthKeyHex(input.masterPassword, profileData.auth_salt);

  // Step 3: Sign in with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: authKeyHex,
  });

  if (authError || !authData.user) {
    throw new Error('Invalid master password. Please try again.');
  }

  // Step 4: Derive vault key (same algorithm as signup — guaranteed identical output)
  const vaultKeyBytes = await deriveVaultKeyBytes(
    input.masterPassword,
    profileData.encrypted_vault_salt
  );

  return {
    profile: profileData as UserProfile,
    vaultKey: { key: vaultKeyBytes, salt: profileData.encrypted_vault_salt },
  };
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Signs out the current user and clears the Supabase session.
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

// ============================================================================
// Vault Key Recovery
// ============================================================================

/**
 * Recovers vault key bytes using the encrypted recovery blob stored in the profile.
 * The user must be authenticated (via password reset flow) before calling this.
 */
export async function recoverUserVaultKey(
  email: string,
  masterPassword: string
): Promise<VaultKeyMaterial> {
  const supabase = getSupabaseClient();

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

  const vaultKeyBytes = await recoverVaultKeyBytes(
    data.encrypted_recovery_key,
    data.recovery_iv,
    data.recovery_salt,
    email,
    masterPassword
  );

  return { key: vaultKeyBytes, salt: data.encrypted_vault_salt };
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
