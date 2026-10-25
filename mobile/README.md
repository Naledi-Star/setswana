# Puo mobile

Expo (SDK 58) + React Native + TypeScript. Phones and tablets, iOS and Android. The learner app is native-only — there is deliberately no Expo web target.

## Run it

```bash
npm install
npm run typecheck
npm test
npm start          # then press i / a, or scan with Expo Go
```

Set the API URL when the app cannot infer it:

```bash
# Android emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000 npm start
# Physical device on the same network
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 npm start
```

Without the variable, the app derives the host from Expo's `hostUri` and uses port 4000, which is correct for Expo Go on a physical device and for the iOS simulator.

Google sign-in is hidden unless client IDs are present:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
```

Push reminders additionally need an EAS project id in `app.json` (`extra.eas.projectId`) and `PUSH_ENABLED=true` on the API. Until then the reminder preference is saved and the app says notifications are not configured.

## Structure

```
src/
  api/          typed REST client, single-flight refresh, DTOs
  auth/         session + guest context
  components/   Icon, Pitsi, AudioButton, shared UI primitives
  design/       colour/type/spacing tokens ported from the design mockup
  lib/          SecureStore, device identity, i18n, haptics, notifications
  navigation/   auth stack, guest stack, learner tabs, admin stack
  screens/
    auth/       welcome, sign in, sign up, reset
    learn/      home path
    lesson/     player, eight exercise renderers, completion
    words/      library, word detail, SRS review
    progress/   streak, accuracy, weekly chart
    settings/   profile, goal, reminders, account deletion
    admin/      units, lessons, exercises, words, config, validation
```

## Behaviour notes

- Access token stays in memory; the refresh token lives in `expo-secure-store` and rotates on every refresh.
- Guest play creates a server session, so scoring and merge-on-signup stay server-side. Only the first published lesson is playable; the guest token lives in SecureStore.
- All exercise correctness, XP, hearts, streaks, unlocks and SRS scheduling come from the API. The client never calculates its own score.
- Listening exercises skip honestly (no heart lost) when a recording is missing. There is no text-to-speech fallback.
- Speaking exercises record locally with `expo-audio`, play back, and ask the learner to self-assess. The app states that it cannot grade pronunciation.
- The mascot is Pitsi the zebra; the colour palette and typography follow the design reference.

## Verification

- `npm run typecheck`
- `npm test` (component tests for shared UI, feedback states, hearts and strings)
- `npx expo export --platform android` bundles the whole app through Metro

No simulator was available in the build environment, so device-level checks (audio playback, push receipt, tablet layout) still need a run on real hardware.
