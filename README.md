# 책숲 (Chaeksoop) — Korean Reading Library

**Status:** Functional, in-development Korean reading web app. Designed for mobile/iPhone reading and offline-friendly use; audio playback and library filtering have had user-reported issues and should be retested before calling the experience finished.

**Live build:** https://art4124.github.io/chaeksoop/

## Purpose

Chaeksoop helps Korean learners practice reading through a personal library, saved vocabulary, and repeatable study interactions. It is a browser-based application rather than a native iOS App Store release.

## Available functionality

- Built-in Korean reading content and a way to add personal Korean text.
- Reading levels and a mobile-oriented reading interface.
- Saved vocabulary and flashcard-based practice.
- Korean audio options, including bundled narration assets and browser speech support.
- Local browser-based preferences/progress and offline-capable app-shell features.
- A web-app manifest for installation on supported devices.

**Development caveat:** An implemented feature is not necessarily fully validated on every iPhone/iOS version. The ongoing audio and library-filtering checks are documented in [the QA checklist](docs/QA_CHECKLIST.md).

## Repository guide

```text
index.html                  App entry point
app.js                      Reader, library, word study, and UI behavior
stories.js                  Built-in reading content
styles.css                  App styling and mobile layout
manifest.webmanifest        Web-app installation metadata
sw.js                       Offline/cache and audio request behavior
assets/                     App icons and supporting assets
audio/index.js              Published audio metadata
audio/<story>/              Narration MP3 files for individual stories
audio/words/                Individual word pronunciation assets
tools/generate_audio.py     Narration asset generation utility
.github/workflows/          Audio generation workflow
docs/QA_CHECKLIST.md        Manual verification checklist
```

The many audio files are purposeful application assets, not temporary files. They are left at their existing paths to preserve references.

## Run the app locally

Use a local HTTP server (rather than opening `index.html` directly) for a representative browser test:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000/ on your computer. Test on an actual iPhone separately for device-specific speech and audio behavior. Browsers may require interaction before audio playback.

The app itself is static. Python is only needed if you want to run the local server or work on the optional audio-generation tooling.

## What I contributed

I directed the learning experience, feature requirements, mobile UX decisions, testing, bug reporting, and iterative changes, using AI assistance for development and debugging. This should not be mistaken for a claim of independent authorship of every line of source code.

## Current priorities

1. Recheck the Hear Word button and audio behavior on iPhone, including silent-mode routing.
2. Verify the **All** books filter displays every eligible book.
3. Test marking a book completed and reversing that status.
4. Verify flashcards can flip repeatedly, show a useful pronunciation, and retain readable layout.
5. Check offline support, data persistence, and backup/import behavior.

These are **test targets**, not a claim that every check currently passes. Progress is saved locally on the device, not to an authenticated server.

## Privacy and reuse

Avoid entering sensitive or confidential text during testing. The project source is public, but no general reuse license is granted by this README.
