# CampUs mobile app

This folder contains the Capacitor build setup for the existing CampUs Lost & Found frontend. The production website and Railway backend remain unchanged.

## Requirements

- Node.js 22 or newer
- Android Studio and Android SDK for Android builds
- macOS with Xcode and Xcode Command Line Tools for iOS builds

## First-time setup (run from the repository root)

```bash
npm install
npm run mobile:prepare
npx cap add android
npx cap add ios
npx cap sync
```

The iOS platform must be added and built on a Mac with Xcode installed.

## Open the native projects

```bash
npx cap open android
npx cap open ios
```

## After frontend changes

```bash
npm run mobile:sync
```

Then rebuild the app in Android Studio or Xcode.

## Architecture

- The app bundles a copy of the existing static frontend from `frontend-source/` into `mobile/www/`.
- The staging script injects the Railway API base URL into the mobile copy only. It does not modify the production website source.
- API requests continue to use the existing Railway backend and its existing authentication-token mechanism.
- The app does not use Capacitor's remote `server.url`; the frontend is bundled locally.
- The website service worker is not registered inside the native WebView.

## App identity

- Display name: CampUs
- Android application ID / iOS bundle ID: `com.jayprakashkkk.campus`

Before store submission, generate the native launcher icons and splash assets, test login/session persistence, report creation, image upload, community chat, notifications and external links on real devices, and complete the store privacy disclosures.
