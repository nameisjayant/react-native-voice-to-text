<div align="center">

# 🎙️ react-native-voice-to-text

**Speech-to-text for React Native, with a ready-made voice search flow.**

Tap the mic → speak → the dialog closes when you stop talking → the text lands in your search bar.

[![npm version](https://img.shields.io/npm/v/@nameisjayant/react-native-voice-to-text?color=cb3837&logo=npm)](https://www.npmjs.com/package/@nameisjayant/react-native-voice-to-text)
[![license](https://img.shields.io/npm/l/@nameisjayant/react-native-voice-to-text?color=blue)](LICENSE)
![platforms](https://img.shields.io/badge/platforms-Android%20%7C%20iOS-lightgrey)
![new architecture](https://img.shields.io/badge/New%20Architecture-TurboModule-6C4DFF)
![typescript](https://img.shields.io/badge/TypeScript-ready-3178C6?logo=typescript&logoColor=white)

<img src="docs/assets/demo-phone.svg" width="300" alt="Demo: tap the mic, the listening dialog shows the words live, closes after 2 seconds of silence, and the text fills the search bar">

### [📖 Docs & interactive demo →](https://nameisjayant.github.io/react-native-voice-to-text/)

<sub>Try the light theme and the bottom-sheet position on the site.</sub>

</div>

---

## 📑 Table of contents

- [Features](#-features)
- [How it works](#-how-it-works)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Usage](#-usage)
  - [1. Drop-in search bar](#1-drop-in-search-bar-easiest)
  - [2. Your own search bar + the dialog](#2-your-own-search-bar--the-dialog)
  - [3. Headless hook](#3-headless-hook-usespeechtotext)
  - [4. Low-level API](#4-low-level-api-speechtotext)
- [Customisation](#-customisation)
- [API reference](#-api-reference)
- [Error codes](#%EF%B8%8F-error-codes)
- [Platform notes](#-platform-notes)
- [Troubleshooting](#%EF%B8%8F-troubleshooting)
- [Example app](#-example-app)
- [License](#-license)

---

## ✨ Features

| | |
| --- | --- |
| 🔍 **Voice search out of the box** | A search bar with a mic button and a listening dialog, in one component. |
| ⏱️ **Auto-stop on silence** | Stops by itself when the user stops talking. No "done" button needed. |
| 📝 **Live transcript** | Words appear in the dialog while the user is speaking. |
| 🔊 **Voice-reactive animation** | The ring around the mic pulses with the microphone level. |
| 🎨 **Fully customisable** | Themes, texts, style overrides, or replace the whole UI. |
| 🧩 **Use as much as you need** | Ready-made UI, a headless hook, or the raw imperative API. |
| 🔑 **No API keys** | Uses the built-in recognizers: Android `SpeechRecognizer` and iOS `SFSpeechRecognizer`. |
| 📴 **On-device option** | Prefer offline recognition where the device supports it. |
| 🌍 **Any locale** | `'en-US'`, `'hi-IN'`, `'es-ES'`, and more. |
| ⚡ **New Architecture** | Built as a TurboModule and fully typed with TypeScript. |

---

## 🔄 How it works

```
 ┌──────────────┐    ┌────────────────────────┐    ┌──────────────────┐    ┌───────────────────┐
 │ 1. User taps │ ─▶ │ 2. Dialog opens:       │ ─▶ │ 3. User stops    │ ─▶ │ 4. Text fills the │
 │    the mic   │    │ "Listening… Speak now" │    │    talking (2 s) │    │    search field & │
 │              │    │  + live transcript     │    │  → dialog closes │    │    search runs    │
 └──────────────┘    └────────────────────────┘    └──────────────────┘    └───────────────────┘
```

- If the user **never speaks**, the dialog closes after 6 seconds, or shows a retry state if you set `closeOnNoSpeech={false}`.
- **Tapping the mic while listening** finishes right away.
- **Tapping the mic after an error** tries again.

---

## 📋 Requirements

| | Minimum |
| --- | --- |
| React Native | New Architecture enabled |
| Android | API 24 (Android 7.0) and a speech recognition service, such as the Google app |
| iOS | The minimum iOS version your React Native version supports |
| Expo | Development builds only. Expo Go is not supported. |

> [!IMPORTANT]
> Test on a **real device**. Most emulators and simulators don't have a working microphone or speech recognizer.

---

## 📦 Installation

```sh
npm install @nameisjayant/react-native-voice-to-text
# or
yarn add @nameisjayant/react-native-voice-to-text
```

Then install the iOS pods:

```sh
cd ios && pod install
```

### 🍎 iOS setup

Add these two usage descriptions to your `Info.plist`. iOS crashes the app if they are missing.

```xml
<key>NSMicrophoneUsageDescription</key>
<string>The microphone is used to search by voice.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>Speech recognition converts what you say into search text.</string>
```

### 🤖 Android setup

**Nothing to do.** The library's manifest already adds:

- the `RECORD_AUDIO` permission
- the `RecognitionService` package-visibility query

The runtime permission prompt appears automatically the first time listening starts.

---

## 🚀 Usage

There are four ways to use this library. Pick the one that fits your app:

| Option | Use it when… | You get |
| --- | --- | --- |
| [`VoiceSearchBar`](#1-drop-in-search-bar-easiest) | You want everything done for you | Search bar + mic + dialog |
| [`MicButton` + `VoiceSearchDialog`](#2-your-own-search-bar--the-dialog) | You already have a search bar | Mic button + dialog |
| [`useSpeechToText`](#3-headless-hook-usespeechtotext) | You want to build your own UI | State and controls, no UI |
| [`SpeechToText`](#4-low-level-api-speechtotext) | You need full manual control | Raw native API and events |

### 1. Drop-in search bar (easiest)

```tsx
import { useState } from 'react';
import { VoiceSearchBar } from '@nameisjayant/react-native-voice-to-text';

export function SearchScreen() {
  const [query, setQuery] = useState('');

  return (
    <VoiceSearchBar
      value={query}
      onChangeText={setQuery}
      onSearch={(text) => runSearch(text)} // keyboard submit OR voice result
      placeholder="Search restaurants"
    />
  );
}
```

### 2. Your own search bar + the dialog

```tsx
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { MicButton, VoiceSearchDialog } from '@nameisjayant/react-native-voice-to-text';

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  return (
    <>
      <View style={styles.searchBar}>
        <TextInput value={query} onChangeText={setQuery} />
        <MicButton onPress={() => setOpen(true)} />
      </View>

      <VoiceSearchDialog
        visible={open}
        onResult={(text) => {
          setQuery(text);
          runSearch(text);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
```

### 3. Headless hook: `useSpeechToText`

Build any UI you like. The hook handles permissions, silence detection, and cleanup.

```tsx
import { useSpeechToText } from '@nameisjayant/react-native-voice-to-text';

const { status, isListening, transcript, volume, error, start, stop, cancel } =
  useSpeechToText({
    locale: 'en-US',
    silenceTimeout: 1500,
    onResult: (text) => setQuery(text),
  });

// <Button title={isListening ? 'Stop' : 'Speak'} onPress={isListening ? stop : start} />
```

### 4. Low-level API: `SpeechToText`

Talks to the native recognizer directly. You handle silence detection and sessions yourself.

```ts
import { SpeechToText } from '@nameisjayant/react-native-voice-to-text';

await SpeechToText.isAvailable();        // is a recognizer installed?
await SpeechToText.requestPermissions(); // ask for microphone (and speech on iOS)

const sub = SpeechToText.onResult(({ value, isFinal }) => {
  console.log(value, isFinal);
});

await SpeechToText.start({ locale: 'en-US' });
await SpeechToText.stop();   // stop listening; the final result follows
await SpeechToText.cancel(); // stop listening; no result

sub.remove();
```

---

## 🎨 Customisation

### Theme, texts and position

```tsx
<VoiceSearchDialog
  visible={open}
  onResult={setQuery}
  onClose={() => setOpen(false)}
  position="bottom"     // 'center' (default) | 'bottom' sheet
  animationType="slide" // 'fade' (default) | 'slide' | 'none'
  theme={{
    backgroundColor: '#14112B',
    primaryColor: '#6C4DFF',
    pulseColor: 'rgba(108, 77, 255, 0.3)',
    borderRadius: 28,
    micSize: 84,
    fontFamily: 'Inter-Regular',
  }}
  texts={{ listening: 'Escuchando…', speakNow: 'Habla ahora', cancel: 'Cancelar' }}
/>
```

### Built-in themes

Two themes are exported. Spread one and change only what you need:

```tsx
import { lightVoiceSearchTheme } from '@nameisjayant/react-native-voice-to-text';

<VoiceSearchDialog theme={{ ...lightVoiceSearchTheme, primaryColor: '#00897B' }} … />
```

| Theme | Look |
| --- | --- |
| `defaultVoiceSearchTheme` | Dark card, red mic (the default) |
| `lightVoiceSearchTheme` | White card, blue mic |

<details>
<summary><b>🎨 All theme keys</b></summary>

| Key | What it colours or sizes | Dark default | Light default |
| --- | --- | --- | --- |
| `backdropColor` | Dim layer behind the dialog | `rgba(0,0,0,0.55)` | `rgba(0,0,0,0.35)` |
| `backgroundColor` | Dialog surface | `#1F1F1F` | `#FFFFFF` |
| `primaryColor` | Mic circle while listening | `#E5483D` | `#1A73E8` |
| `inactiveColor` | Mic circle after no-speech or an error | `#5A5A5A` | `#BDBDBD` |
| `pulseColor` | Ring that follows the voice level | `rgba(229,72,61,0.28)` | `rgba(26,115,232,0.2)` |
| `micIconColor` | Mic glyph | `#FFFFFF` | `#FFFFFF` |
| `titleColor` | "Listening…" | `#FFFFFF` | `#202124` |
| `subtitleColor` | "Speak now" | `#B4B4B4` | `#5F6368` |
| `transcriptColor` | Live words | `#FFFFFF` | `#202124` |
| `errorColor` | Error message | `#FF8A80` | `#D93025` |
| `buttonTextColor` | Cancel button | `#B4B4B4` | `#5F6368` |
| `borderRadius` | Card corner radius | `20` | `20` |
| `micSize` | Mic circle diameter | `76` | `76` |
| `fontFamily` | Font for all texts | system | system |

</details>

<details>
<summary><b>💬 All text keys (for translation)</b></summary>

| Key | Default |
| --- | --- |
| `starting` | Getting ready… |
| `listening` | Listening… |
| `speakNow` | Speak now |
| `processing` | Got it |
| `noSpeech` | Didn't catch that |
| `tapToRetry` | Tap the mic to try again |
| `error` | Something went wrong |
| `permissionDenied` | Microphone permission is required |
| `cancel` | Cancel |

`defaultVoiceSearchTexts` is exported too.

</details>

### Style overrides

Each part of the dialog takes its own style prop:

`backdropStyle` · `cardStyle` · `micContainerStyle` · `titleStyle` · `subtitleStyle` · `transcriptStyle` · `cancelButtonStyle` · `cancelTextStyle`

### Replace parts of the UI

```tsx
// Your own icon inside the mic circle
<VoiceSearchDialog
  renderMicIcon={({ size, color, status }) => <Icon name="mic" size={size} color={color} />}
  …
/>

// Your own dialog content. The library still handles listening and silence detection.
<VoiceSearchDialog
  renderContent={({ status, transcript, volume, stop, retry, cancel }) => (
    <MyListeningCard status={status} text={transcript} level={volume} onStop={stop} onCancel={cancel} />
  )}
  …
/>
```

### Customise the search bar

```tsx
<VoiceSearchBar
  value={query}
  onChangeText={setQuery}
  containerStyle={{ backgroundColor: '#EEE', borderRadius: 12 }}
  searchIconColor="#888"
  micButtonProps={{ backgroundColor: '#6C4DFF', iconColor: '#FFF' }}
  dialogProps={{ position: 'bottom', theme: lightVoiceSearchTheme }}
/>
```

---

## 📚 API reference

### `<VoiceSearchBar />`

Accepts every `TextInput` prop, plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onSearch` | `(text) => void` | — | Called on keyboard submit and on a voice result |
| `fillOnly` | `boolean` | `false` | Fill the field with the voice result without calling `onSearch` |
| `containerStyle` | `ViewStyle` | — | Style for the outer bar |
| `inputStyle` | `TextStyle` | — | Style for the text input |
| `showSearchIcon` | `boolean` | `true` | Show the search icon on the left |
| `searchIconColor` | `string` | `'#5F6368'` | Colour of the search icon |
| `renderSearchIcon` | `() => ReactNode` | — | Replace the search icon |
| `micButtonProps` | `Partial<MicButtonProps>` | — | Props passed to the mic button |
| `renderMicButton` | `({ open }) => ReactNode` | — | Replace the mic button. Call `open()` to show the dialog |
| `dialogProps` | `Partial<VoiceSearchDialogProps>` | — | Anything `VoiceSearchDialog` accepts |

### `<VoiceSearchDialog />`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `visible` | `boolean` | **required** | Show or hide the dialog |
| `onResult` | `(text) => void` | **required** | Called with the recognised text (never empty) |
| `onClose` | `() => void` | **required** | Called whenever the dialog wants to close |
| `position` | `'center' \| 'bottom'` | `'center'` | Centred card or bottom sheet |
| `animationType` | `'fade' \| 'slide' \| 'none'` | `'fade'` | Open/close animation |
| `closeOnNoSpeech` | `boolean` | `true` | If `false`, show "Didn't catch that" with a retry instead of closing |
| `dismissOnBackdropPress` | `boolean` | `true` | Tapping outside the card cancels |
| `showTranscript` | `boolean` | `true` | Show the live words |
| `showCancelButton` | `boolean` | `true` | Show the Cancel button |
| `theme` | `Partial<VoiceSearchTheme>` | dark theme | See [Built-in themes](#built-in-themes) |
| `texts` | `Partial<VoiceSearchTexts>` | English | See [Built-in themes](#built-in-themes) |
| `renderMicIcon` | `({ size, color, status }) => ReactNode` | — | Replace the mic glyph |
| `renderContent` | `(props) => ReactNode` | — | Replace everything inside the card |
| *style props* | | | See [Style overrides](#style-overrides) |
| *behaviour options* | | | See [Behaviour options](#behaviour-options) |

### `<MicButton />`

Accepts every `Pressable` prop (such as `onPress`), plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `size` | `number` | `40` | Button diameter |
| `iconColor` | `string` | `'#5F6368'` | Mic glyph colour |
| `backgroundColor` | `string` | `'transparent'` | Button colour |
| `pressedOpacity` | `number` | `0.6` | Opacity while pressed |
| `style` | `ViewStyle` | — | Extra styles |
| `icon` | `ReactNode` | — | Replace the mic glyph |

`MicIcon` and `SearchIcon` are exported too, if you want the glyphs on their own.

### Behaviour options

These work on `VoiceSearchDialog`, on `VoiceSearchBar` through `dialogProps`, and on `useSpeechToText`:

| Option | Default | Description |
| --- | --- | --- |
| `silenceTimeout` | `2000` | Milliseconds of silence, after the user starts speaking, before it stops |
| `initialSilenceTimeout` | `6000` | Milliseconds to wait for the user to start speaking |
| `maxDuration` | `60000` | Hard limit on a session in milliseconds (`0` = no limit) |
| `locale` | device language | For example `'en-US'` or `'hi-IN'` |
| `onDevice` | `false` | Prefer offline recognition where supported |
| `onPartialResult` | — | `(text) => void`, called with the live transcript |
| `onError` | — | `(error: SpeechError) => void` |

### `useSpeechToText(options)`

Takes the [behaviour options](#behaviour-options) plus `onResult(text)` and `onEnd(text, error?)`. Returns:

| Field | Type | Description |
| --- | --- | --- |
| `status` | `'idle' \| 'starting' \| 'listening' \| 'processing' \| 'error'` | Current state |
| `isListening` | `boolean` | `true` while recording |
| `transcript` | `string` | Live transcript of the current or last session |
| `volume` | `number` | Microphone level from `0` to `1` |
| `error` | `SpeechError \| null` | Last error |
| `start()` | `() => Promise<void>` | Ask for permission if needed, then start listening |
| `stop()` | `() => void` | Stop now and deliver what was heard |
| `cancel()` | `() => void` | Stop now without a result |

### `SpeechToText`

| Method | Returns | Description |
| --- | --- | --- |
| `isAvailable()` | `Promise<boolean>` | Is a speech recognizer installed? |
| `hasPermissions()` | `Promise<boolean>` | Are permissions already granted? |
| `requestPermissions()` | `Promise<boolean>` | Ask the user for permissions |
| `start(options?)` | `Promise<void>` | Start listening. Options: `locale`, `onDevice`, `silenceTimeout` |
| `stop()` | `Promise<void>` | Stop; the final result is delivered |
| `cancel()` | `Promise<void>` | Stop; no result |
| `onResult(cb)` | subscription | `({ value, isFinal }) => void` |
| `onError(cb)` | subscription | `(error: SpeechError) => void` |
| `onVolumeChange(cb)` | subscription | `(volume: number) => void`, from `0` to `1` |
| `onStart(cb)` / `onEnd(cb)` | subscription | The session started / ended |

Call `.remove()` on a subscription to stop receiving events.

---

## ⚠️ Error codes

`SpeechError` is `{ code, message }`. Possible `code` values:

| Code | Meaning |
| --- | --- |
| `permission_denied` | The user refused microphone or speech permission |
| `unavailable` | No speech recognizer on this device |
| `start_failed` | The recognizer couldn't start |
| `no_match` | Nothing recognisable was said |
| `speech_timeout` | The user didn't speak in time |
| `audio` | Microphone or audio recording problem |
| `network` / `network_timeout` | The network needed for recognition failed |
| `busy` | The recognizer is already in use |
| `server` / `client` | Error from the recognition service |
| `recognition_failed` / `unknown` | Any other failure |

---

## 📱 Platform notes

- **Android** also ends sessions with its own silence detection, which can be shorter than a long `silenceTimeout`. The library passes your timeout as a hint, but some devices ignore it.
- **iOS** has no built-in end-of-speech detection, so `silenceTimeout` is what ends the session.
- **One session at a time.** Starting a new session cancels the previous one.

---

## 🛠️ Troubleshooting

<details>
<summary><b>"The package doesn't seem to be linked"</b></summary>

- Run `cd ios && pod install`.
- Rebuild the app after installing. A JavaScript reload is not enough.
- Don't use Expo Go. Use a development build.

</details>

<details>
<summary><b><code>isAvailable()</code> returns <code>false</code> on Android</b></summary>

The device has no speech recognition service. Install or enable the **Google** app. Most emulators don't include one, so use a real device.

</details>

<details>
<summary><b>The app crashes on iOS when the mic opens</b></summary>

`NSMicrophoneUsageDescription` or `NSSpeechRecognitionUsageDescription` is missing from `Info.plist`. See [iOS setup](#-ios-setup).

</details>

<details>
<summary><b>Listening stops too quickly on Android</b></summary>

Some Android recognizers use their own short silence timeout and ignore the hint. See [Platform notes](#-platform-notes).

</details>

---

## 🧪 Example app

```sh
yarn
yarn example android
yarn example ios
```

---

## 🤝 Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

[MIT](LICENSE) © [Jayant Kumar](https://github.com/nameisjayant)

<div align="center">
<sub>If this library helped you, please consider giving it a ⭐</sub>
</div>
