// ============================================================================
// VaultSync — Supabase Client Factory
// Platform-agnostic client that accepts credentials at runtime
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare const process: any;
declare const chrome: any;

let supabaseInstance: SupabaseClient | null = null;
let customStorageAdapter: any = null;

export function setSupabaseStorageAdapter(adapter: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}) {
  customStorageAdapter = adapter;
}

/**
 * A universal storage adapter that dynamically switches to chrome.storage.local
 * when executed inside the Chrome Extension environment.
 */
const universalStorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return new Promise(async (resolve) => {
      if (customStorageAdapter) {
        resolve(await customStorageAdapter.getItem(key));
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([key], (result: any) => {
          resolve(result[key] || null);
        });
      } else if (typeof window !== 'undefined' && window.localStorage) {
        resolve(window.localStorage.getItem(key));
      } else {
        resolve(null);
      }
    });
  },
  setItem: (key: string, value: string): Promise<void> => {
    return new Promise(async (resolve) => {
      if (customStorageAdapter) {
        await customStorageAdapter.setItem(key, value);
        resolve();
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      } else if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        resolve();
      } else {
        resolve();
      }
    });
  },
  removeItem: (key: string): Promise<void> => {
    return new Promise(async (resolve) => {
      if (customStorageAdapter) {
        await customStorageAdapter.removeItem(key);
        resolve();
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove([key], () => resolve());
      } else if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        resolve();
      } else {
        resolve();
      }
    });
  }
};

/**
 * Creates or returns the Supabase client singleton.
 * Each platform (web, mobile, extension) provides its own credentials.
 */
export function getSupabaseClient(
  url?: string,
  anonKey?: string
): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = url || getEnvVar('SUPABASE_URL');
  const supabaseAnonKey = anonKey || getEnvVar('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'VaultSync: Missing Supabase credentials. ' +
      'Provide SUPABASE_URL and SUPABASE_ANON_KEY.'
    );
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: universalStorageAdapter,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return supabaseInstance;
}

/**
 * Resets the singleton (useful for testing and sign-out).
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
}

/**
 * Cross-platform env var getter.
 * Supports Next.js (NEXT_PUBLIC_), Expo (EXPO_PUBLIC_), and plain env vars.
 */
function getEnvVar(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    if (name === 'SUPABASE_URL') {
      return (
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL
      );
    }
    if (name === 'SUPABASE_ANON_KEY') {
      return (
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY
      );
    }
    if (name === 'ENCRYPTION_ITERATIONS') {
      return (
        process.env.ENCRYPTION_ITERATIONS ||
        process.env.NEXT_PUBLIC_ENCRYPTION_ITERATIONS ||
        process.env.EXPO_PUBLIC_ENCRYPTION_ITERATIONS
      );
    }
  }
  return undefined;
}
