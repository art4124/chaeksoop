# Chaeksoop — Manual QA Checklist

This is a testing plan, **not a completed test report**. Mark each item after reproducing it on the indicated device and record the browser/iOS version.

## Library and reading

- [ ] The **All** filter displays every available eligible book, including built-in and personally added items.
- [ ] Level-specific filters show the correct subset.
- [ ] Book completion state can be turned on and back off.
- [ ] Reading progress is restored after closing and reopening the app.
- [ ] Adding Korean text through the UI works on desktop and iPhone.

## Words and flashcards

- [ ] A word can be saved from the reader.
- [ ] The Words section shows saved entries with correct Korean and English text.
- [ ] Flashcards show Korean on the front and the translation on the back.
- [ ] A card can flip back and forth repeatedly with legible spacing.
- [ ] Pronunciation guidance appears where intended.

## Audio on iPhone

- [ ] **Hear Word** produces audible sound for an available word.
- [ ] Playback works with the hardware silent switch enabled when the intended audio route supports it.
- [ ] Playback respects user media volume.
- [ ] Story narration plays and can be stopped/started predictably.
- [ ] Offline available-audio behavior is checked after installation.

## Stability

- [ ] Navigation works at narrow phone widths.
- [ ] Local progress remains after refreshing (subject to browser storage settings).
- [ ] Service worker/app shell updates do not leave stale functionality behind.
- [ ] Browser console shows no unhandled errors during core reading and study workflows.

**Recording a failure:** Include device, OS/browser version, steps to reproduce, expected result, actual result, and, if available, a screenshot. Do not mark a test passed without performing it.
