#!/usr/bin/env python3
"""Build static Korean narration for 책숲. Runtime app needs no TTS server.

Generated narration is bundled as ordinary MP3 files, so iOS routes it
through HTMLAudioElement rather than Web Speech's Silent Mode-sensitive output.
"""
import asyncio
import hashlib
import json
import re
from pathlib import Path

import edge_tts
from gtts import gTTS

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
STORY_FILE = ROOT / "stories.js"
VOICE = "ko-KR-SunHiNeural"  # Korean voice used only during audio file build
CONCURRENCY = 3

def load_stories():
    content = STORY_FILE.read_text(encoding="utf-8")
    found = re.search(r"window\.CHAEKSOOP_STORIES\s*=\s*(\[[\s\S]*?\]);\s*window\.CHAEKSOOP_PUBLISHED", content)
    if not found:
        raise ValueError("Cannot find embedded JSON story list")
    books = json.loads(found.group(1))
    if not isinstance(books, list) or not books:
        raise ValueError("Empty story library")
    return books

async def save_clip(text, path, sem):
    if path.is_file() and path.stat().st_size > 1000:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    async with sem:
        for retry in range(3):
            try:
                await edge_tts.Communicate(text, VOICE, rate="-10%").save(str(path))
                if path.stat().st_size < 1000:
                    raise ValueError("Empty audio file")
                return
            except Exception as error:
                if path.exists():
                    path.unlink()
                print(f"Edge TTS retry {retry + 1}: {path.name}: {error}", flush=True)
                await asyncio.sleep(1.5 * (retry + 1))
        # Google's speech synthesizer is a build-time backup, not a dependency
        # of the installed app.
        await asyncio.to_thread(gTTS(text, lang="ko").save, str(path))
        if not path.exists() or path.stat().st_size < 1000:
            raise RuntimeError(f"Audio not generated for {path}")

async def main():
    books = load_stories()
    audio_map = {"version": 2, "paragraphs": {}, "complete": {}, "words": {}, "test": "./audio/test.mp3"}
    work = []
    test = "안녕하세요. 책숲에서 한국어를 읽어요."
    work.append((test, AUDIO / "test.mp3"))
    words = set()
    for book in books:
        ident = book["id"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", ident):
            raise ValueError("Invalid book ID")
        parts = [p["ko"].strip() for p in book["paragraphs"]]
        if not parts or any(not p for p in parts):
            raise ValueError(f"Book {ident} has an empty paragraph")
        audio_map["paragraphs"][ident] = []
        for i, text in enumerate(parts):
            name = f"./audio/{ident}/p{i}.mp3"
            audio_map["paragraphs"][ident].append(name)
            work.append((text, AUDIO / ident / f"p{i}.mp3"))
        full = f"./audio/{ident}/full.mp3"
        audio_map["complete"][ident] = full
        work.append(("\n\n".join(parts), AUDIO / ident / "full.mp3"))
        # Every tappable Korean word in the actual story must have an MP3.
        # Previously only glossary headwords were recorded; inflected forms
        # such as '토요일이에요' and '비가' silently fell back to iOS TTS.
        for passage in parts:
            for chunk in passage.split():
                displayed_word = re.sub(r"^[^가-힣]+|[^가-힣]+$", "", chunk)
                if re.search(r"[가-힣]", displayed_word):
                    words.add(displayed_word)
        for item in book.get("glossary", []):
            word = str(item.get("word", "")).strip()
            if word:
                words.add(word)
    for word in sorted(words):
        name = hashlib.sha256(word.encode("utf-8")).hexdigest()[:20] + ".mp3"
        audio_map["words"][word] = f"./audio/words/{name}"
        work.append((word, AUDIO / "words" / name))
    sem = asyncio.Semaphore(CONCURRENCY)
    print(f"Building {len(work)} audio files, {len(books)} books, {len(words)} glossary words", flush=True)
    # Restrict concurrency to avoid overwhelming either TTS provider.
    results = await asyncio.gather(*(save_clip(text, path, sem) for text, path in work), return_exceptions=True)
    failures = [(str(path), str(result)) for (_, path), result in zip(work, results) if isinstance(result, BaseException)]
    if failures:
        raise RuntimeError(f"Audio build incomplete ({len(failures)} failures): {failures[:6]}")
    (AUDIO / "index.js").write_text(
        "/* Static narration for 책숲, loaded without an API */\nwindow.CHAEKSOOP_AUDIO = " +
        json.dumps(audio_map, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    (AUDIO / "files.json").write_text(
        json.dumps([path.relative_to(ROOT).as_posix() for _, path in work], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(work)} MP3 clips and index.js. All clips are offline-capable.", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
