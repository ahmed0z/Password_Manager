# Changelog

All notable changes to the VaultSync password manager project are documented in this file.

## [v1.2.0] - 2026-06-23

### Added
- **Zero-Flicker Native Sidebar Resize**: Restored standard horizontal resizing for the web app folders sidebar. The width is persisted dynamically via cookies (`vaultsync-sidebar-width`) and loaded synchronously before body paint using an inline script in layout `<head>`, preventing layout shifting or flickering.
- **Glassmorphic Top Navigation Bar**: Configured a translucent background overlay for the top navigation bar (`.top-nav`) matching light/dark theme colors, paired with backdrop blur (`backdrop-filter: blur(12px)`) so content scrolls behind it clearly.
- **Offset Modal Positioning**: Adjusted modals (like Add Password, Edit Password) to sit directly below the top navigation bar (`top: 74px`) without overlapping. Configured `align-items: flex-start; padding: 24px 16px;` and constrained the max height (`max-height: calc(100vh - 122px)`) to allow internal form scrolling.
- **Chrome Extension Dismissible Autofill**: Added a functional close dismiss button to the floating credentials bubble rendered by the content script to allow immediate UI dismissal.
- **Mobile Layout & Build Verification**: Verified clean production compilation across all packages and resolved Expo CLI/Metro resolution configuration alignments.

---

## [v1.1.0] - 2026-06-20

### Added
- **Keyboard Auto-Dismiss on Mobile**: Added dismiss-on-tap-outside wrappers and scroll-to-dismiss behavior (`keyboardDismissMode="on-drag"`) in login and sign-up screen inputs, ensuring easy keyboard dismissal.
- **FlatList Optimization**: Replaced heavy nested ScrollView mapped listings on the vault page with virtualized `<FlatList>` components for logins and bookmarks. Improves list rendering performance, tab switching latency, and removes scroll delay.

### Fixed
- **Overlay Rendering Block**: Resolved a bug in the bottom sheet `FloatingPanel` absolute overlay that left a transparent black backdrop layer blocking mouse clicks and views on settings and vault screens when visible was false. Coordinates renders via `shouldRender` state variable.
- **BottomSheet Gestures Isolation**: Structured the dim overlay and sliding credentials panel as sibling views instead of nested touchables, restoring custom dragging and scrolling sheet gestures from any area of the panel card.
- **BackHandler Android Compilation**: Replaced the deprecated `BackHandler.removeEventListener` method call with the subscription object `.remove()` pattern in `SharedComponents.tsx` to fix TypeScript compiler failures.

---

## [v1.0.9] - 2026-06-19

### Added
- **Keyboard Height Adaptation**: Bottom sheet modals now dynamically listen to the system keyboard height, auto-expanding to full height and adding bottom scroll padding to prevent keyboard overlap on text inputs.
- **Folder CRUD Modals**: Integrated UI modals for creating and renaming folders for both logins and bookmarks inside the mobile application.

### Fixed
- **Bottom Sheet Stability & Performance**: Re-engineered modal animations from JS-based height layout transitions to native `translateY` transforms, resolving UI flickering and settling delays.
- **Instant Subtab Transitions**: Converted conditional mounts on Logins/Bookmarks pages to flex-layout displays, eliminating rendering lags.
- **Bookmarks List CPU Optimization**: Switched domain extraction from heavy `new URL()` instantiations to simple string slices, speeding up list rendering times.
- **Android Keyboard Resize Flash**: Configured Android activity window background to match the slate theme, resolving transition gaps.
- **Removed Devices Page**: Cleaned up layout files to delete devices view entries and tab navigation dependencies.

---

## [v1.0.8] - 2026-06-19

### Added
- **Extension Badge Notifications**: Implemented dynamic saved credentials badge indicators on the extension action icon. Shows a sleek red badge displaying the exact count of matching credentials for the active tab's domain, a gray `!` badge if no credentials exist, or no badge if logged out or browsing local/internal pages.
- **Realtime Database Synchronization**: Integrated client-side Supabase Realtime postgres changes subscriptions across all three platforms (Web App, Chrome Extension Side Panel, and Mobile App screens) to listen for updates on `vault_items`, `folders`, and `bookmarks` tables, propagating changes instantly across all devices.

### Fixed
- **Web Modal Viewport Alignment**: Resolved layout bugs in dashboard page modals. Switched page transition animation from `fadeInUp` (which left a permanent `transform` containing block context) to `fadeIn`, fixing viewport-fixed sizing for `.modal-overlay`. Added `margin: auto` to `.modal-content` to prevent top-viewport overflow on shorter screens.
- **Web Modal Animation Override**: Removed inline animation style (`scaleUp`) from `EditPasswordModal` to inherit global `.modal-content` transitions correctly.

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
