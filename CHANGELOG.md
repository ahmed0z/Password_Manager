# Changelog

All notable changes to the VaultSync password manager project are documented in this file.

---

## [v1.0.7] - 2026-06-17

### Added
- **Unified Storage Adapter**: Implemented `coreStorage` in `@vaultsync/core` to seamlessly resolve storage interactions across `localStorage` (Web), `chrome.storage.local` (Extension), and custom React Native wrappers (Mobile).
- **Encrypted Offline Caching**: Added automatic caching of encrypted credentials and bookmarks. If the network goes offline, the retrieval functions fallback seamlessly to decrypting local cached items.
- **Persistent Extension Session**: Switched the `vaultKey` and `vaultSalt` storage from ephemeral `chrome.storage.session` to `chrome.storage.local`. The extension now remains logged in across browser restarts and computer reboots, while keeping the security inactivity timeout check active.
- **Web App Auto-Redirects**: Added check-redirect hooks to `/auth/login` and `/auth/signup` to automatically route logged-in users with a valid vault key directly to the dashboard.

### Fixed
- **TypeScript Namespace Resolution**: Removed a duplicate `declare const chrome` declaration in the autofill script that was conflict-shadowing `@types/chrome`.
- **Vitest Cryptographic Timeout**: Resolved the 5-second test execution timeout in pure JavaScript Node environment by introducing test iteration overrides.

---

## [v1.0.6] - 2026-06-16

### Added
- **Mobile Cryptographic Polyfills**: Injected `global.crypto.getRandomValues` polyfill inside `apps/mobile/app/_layout.tsx` using `expo-crypto` to fix the `property crypto not found` crash on native devices.

### Fixed
- **Mobile Sign-In event loop hang**: Converted the static 600,000 PBKDF2 iterations to be dynamic. The codebase now reads iterations from environment variables (`EXPO_PUBLIC_ENCRYPTION_ITERATIONS=10000` for development), resolving the 30-90+ seconds UI freeze in Expo Go.
- **Vite Define Evaluator**: Wrapped environment variable lookups in try-catch blocks to safely run inside the Chrome Extension sidepanel context.

---

## [v1.0.5] - 2026-06-16

### Added
- **Mobile App Workspace**: Initialized the React Native mobile app workspace utilizing Expo SDK 54 and unified TS configurations.

---

## [v1.0.4] - 2026-06-12

### Fixed
- **Extension Content Script**: Configured the extension build config to output the content autofill scripts as an Immediately Invoked Function Expression (IIFE) to prevent namespace pollution on page injection.

---

## [v1.0.3] - 2026-06-06

### Chore
- Unified monorepo version bounds to `1.0.3`.

---

## [v1.0.2] - 2026-06-06

### Chore
- Export alignments inside `@vaultsync/core` entry points.

---

## [v1.0.1] - 2026-06-06

### Added
- **Session Timeout Settings**: Implemented adjustable autolock timers (12h, 24h, 2d, always).
- **Service Worker startup refresh**: Added token refresh routines upon browser startup.
- **Netlify Configuration**: Setup Netlify deploy structures.

---

## [v1.0.0] - 2026-06-06

### Added
- **Initial Setup**: Configured the pnpm monorepo structure.
- **Core Cryptography**: Integrated PBKDF2-SHA256 vault key derivations and AES-256-GCM data encryption/decryption modules.
- **Auth Systems**: Wired email/password sign-in and recovery options using Supabase authentication.
