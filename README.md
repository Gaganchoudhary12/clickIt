# clickIt

clickIt is an Android auto-clicker built with React Native and a small native
Kotlin accessibility service. It places a draggable target and Start/Stop bubble
over other apps, then repeatedly taps the selected area.

## Features

- One draggable click target that stays visible over other apps
- Movable floating Play/Stop control
- Configurable interval from 100 ms to 60 seconds
- Configurable tap radius from 0 to 100 dp
- Uniformly distributed tap points inside the user-selected circle
- Saved settings and overlay positions
- No screen-content access and no analytics

## Platform support

The auto-clicking feature is Android-only and requires Android 8.0 (API 26) or
newer. iOS does not allow normal apps to inject touches into other apps.

## Run locally

Requirements:

- Node.js 22.11 or newer
- Java 17
- Android Studio and Android SDK 37
- An Android emulator or connected Android device

Install dependencies and start Metro:

```sh
nvm use
npm install
npm start
```

In another terminal, install the debug app:

```sh
npm run android
```

## Use the app

1. Tap **Enable accessibility**.
2. Select **ClickIt auto clicker** in Android Accessibility settings and enable it.
3. Return to clickIt and set the interval and tap radius.
4. Tap **Show floating controls**.
5. Switch to the target app and drag the purple target to the desired location.
6. Tap the green floating Play button. It turns red while clicking.
7. Tap the red Stop button to stop immediately.

The target is made touch-through while the loop is running, so generated taps
reach the app underneath it.

## Checks and local APK build

```sh
npm run lint
npm run typecheck
npm test -- --runInBand --no-watchman
npm run android:apk
```

An installable standalone APK is written to
`android/app/build/outputs/apk/release/app-release.apk`. Without production
signing configuration, APK builds use the included local test key and must not
be uploaded to Google Play.

## Google Play bundle and signing

Google Play bundles never use the included debug key. To configure your private
Google Play upload key:

1. Generate and securely back up an upload keystore.
2. Copy `android/keystore.properties.example` to
   `android/keystore.properties`.
3. Replace all example values and keep both the properties file and keystore
   private.
4. Run `npm run android:bundle`.

The signed bundle is written to
`android/app/build/outputs/bundle/release/app-release.aab`. The bundle task fails
with a clear message if production signing is not configured.

Gradle automatically uses the Node version pinned in `.nvmrc`, even when it is
started by Android Studio or a shell whose default Node is older. CI can override
the binary by setting `NODE_BINARY` to an absolute Node 22 path.

Before creating the Play Console app, replace the generic `com.clickit`
application ID with a permanent reverse-domain package ID that you control.
Google Play also requires a public privacy-policy URL; the app includes the
matching in-app notice, but the public page and support contact must be supplied
in Play Console.

## Accessibility disclosure

clickIt declares `canPerformGestures` so Android can perform taps requested by
the user. Before opening Android Accessibility settings, the app displays a
prominent disclosure with Continue and Not now actions. The service declares
`canRetrieveWindowContent="false"`, does not subscribe to accessibility events,
and does not transmit or store screen content.
