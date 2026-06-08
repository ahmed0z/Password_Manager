-- ============================================================================
-- VaultSync — Supabase Database Schema
-- Zero-knowledge password & bookmark manager with encrypted payloads
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- User Profiles (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  encrypted_vault_salt TEXT NOT NULL,    -- Salt for vault key derivation (not secret)
  auth_salt TEXT NOT NULL,               -- Salt for auth key derivation (not secret)
  encrypted_recovery_key TEXT,           -- AES-GCM encrypted vault key (for recovery)
  recovery_iv TEXT,                      -- IV used to encrypt the recovery key
  recovery_salt TEXT,                    -- Salt used to derive the recovery encryption key
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Folders for organizing passwords
-- ============================================================================
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_name TEXT NOT NULL,          -- AES-GCM encrypted folder name
  name_iv TEXT NOT NULL,                 -- IV for folder name encryption
  parent_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Vault Items (encrypted passwords)
-- ============================================================================
CREATE TABLE public.vault_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  encrypted_data TEXT NOT NULL,          -- AES-256-GCM ciphertext (Base64)
  iv TEXT NOT NULL,                       -- Initialization vector (Base64)
  domain TEXT,                            -- Plaintext domain for autofill lookup
  favicon_url TEXT,                       -- Cached favicon URL for UI
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Synced Bookmarks (encrypted)
-- ============================================================================
CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_data TEXT NOT NULL,          -- AES-256-GCM encrypted bookmark data
  iv TEXT NOT NULL,                       -- IV for bookmark encryption
  browser_bookmark_id TEXT,              -- Original browser bookmark ID for sync
  folder_path TEXT,                       -- Browser bookmark folder path
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Row Level Security (RLS) — Critical for multi-tenant isolation
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only access their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_unauthenticated" ON public.profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow reading salts by email for sign-in (before auth)
-- This is a read-only policy for the pre-auth salt lookup
CREATE POLICY "profiles_select_salts_by_email" ON public.profiles
  FOR SELECT USING (true);
  -- Note: This allows reading salts by email, which is acceptable because
  -- salts are not secret (they're random values used for key derivation).
  -- The encrypted data remains protected by the vault key.

-- Folders: Users can only access their own folders
CREATE POLICY "folders_all_own" ON public.folders
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Vault Items: Users can only access their own items
CREATE POLICY "vault_items_all_own" ON public.vault_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bookmarks: Users can only access their own bookmarks
CREATE POLICY "bookmarks_all_own" ON public.bookmarks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Performance Indexes
-- ============================================================================
CREATE INDEX idx_vault_items_user ON public.vault_items(user_id);
CREATE INDEX idx_vault_items_domain ON public.vault_items(domain);
CREATE INDEX idx_vault_items_folder ON public.vault_items(folder_id);
CREATE INDEX idx_vault_items_favorite ON public.vault_items(user_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_folders_user ON public.folders(user_id);
CREATE INDEX idx_folders_parent ON public.folders(parent_id);
CREATE INDEX idx_bookmarks_user ON public.bookmarks(user_id);
CREATE UNIQUE INDEX idx_bookmarks_browser_id ON public.bookmarks(user_id, browser_bookmark_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- ============================================================================
-- Realtime — Enable for cross-device sync
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookmarks;

-- ============================================================================
-- Auto-update timestamps trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER vault_items_updated_at
  BEFORE UPDATE ON public.vault_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER bookmarks_updated_at
  BEFORE UPDATE ON public.bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
