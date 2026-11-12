/* 책숲 — simple local-first Korean reading app. */
(() => {
  'use strict';

  const KEY = 'chaeksoop.state.v1';
  const builtIn = window.CHAEKSOOP_STORIES || [];
  const published = window.CHAEKSOOP_PUBLISHED || [];
  const levels = {
    1:'Level 1 · Beginner',
    2:'Level 2 · Early elementary',
    3:'Level 3 · Upper elementary',
    4:'Level 4 · Longer reading'
  };
  const kinds = {
    all:'All',
    original:'Original',
    folktale:'Folktales',
    published:'Published',
    imported:'My books'
  };
  const navs = [
    ['home','home','Home'],
    ['library','library','Books'],
    ['words','vocab','Words']
  ];
  const initial = {
    theme:'light',
    fontSize:21,
    translation:'tap',
    speechRate:0.9,
    libraryKind:'all',
    libraryLevel:'all',
    lastRead:null,
    progress:{},
    positions:{},
    favorites:[],
    complete:[],
    words:{},
    days:[],
    imported:[]
  };

  let state;
  try { state = {...initial, ...JSON.parse(localStorage.getItem(KEY) || '{}')}; }
  catch { state = {...initial}; }

  const $ = sel => document.querySelector(sel);
  const screen = $('#screen');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const attr = escape;
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const bunnyImg = './assets/icon-192.png';
  const allBooks = () => [...builtIn, ...state.imported, ...published];
  const findBook = id => allBooks().find(book => book.id === id);
  const readable = book => book && book.kind !== 'published';
  const readingTime = book => Math.max(1, Math.ceil((book.paragraphs || []).reduce((sum, p) => sum + (p.ko || '').length, 0) / 230));
  const isFavorite = id => state.favorites.includes(id);
  const isComplete = id => state.complete.includes(id);
  const dateKey = () => new Date().toLocaleDateString('en-CA');

  let routeName = 'home';
  let readingReturnRoute = 'library';
  let displayedBookId = null;
  let readerId = null;
  let vocabSelected = null;
  let searchQuery = '';
  let visibleTrans = new Set();
  let speaking = false;
  let speakSequence = [];
  let toastTimer = null;
  let scrollTimer = null;

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { toast('Storage is full. Please export a backup.'); }
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 2800);
  }

  function markDay() {
    const today = dateKey();
    if (!state.days.includes(today)) {
      state.days.push(today);
      state.days = state.days.slice(-365);
      save();
    }
  }

  function goto(path) {
    if (path.startsWith('read/')) readingReturnRoute = routeName === 'home' ? 'home' : 'library';
    location.hash = '#' + path;
  }

  function setTheme() {
    document.body.classList.toggle('dark', state.theme === 'dark');
    document.documentElement.style.setProperty('--reading-size', state.fontSize + 'px');
  }

  function syncNav(active) {
    $('#bottom-nav').innerHTML = navs.map(([name, sym, label]) => `
      <button class="nav-item ${active === name ? 'active' : ''}" data-go="${name}" ${active === name ? 'aria-current="page"' : ''}>
        ${icon(sym)}
        <span>${label}</span>
      </button>
    `).join('');
  }

  function cover(book, badge = true) {
    const ribbon = book.kind === 'published' ? '↗ ONLINE' : book.kind === 'imported' ? 'MY BOOK' : `LEVEL ${book.level}`;
    return `
      <div class="book-cover cover--${escape(book.theme || 'sage')}" aria-hidden="true">
        <span class="cover-cloud"></span>
        <span class="cover-hill"></span>
        <span class="cover-hill2"></span>
        <span class="cover-spark">✳</span>
        <span class="cover-emoji">${escape(book.emoji || '📘')}</span>
        ${badge ? `<span class="book-ribbon">${ribbon}</span>` : ''}
      </div>
    `;
  }

  function progressLabel(book) {
    if (book.kind === 'published') return 'Opens website';
    if (isComplete(book.id)) return 'Finished';
    const p = state.progress[book.id] || 0;
    return p > 2 ? `${Math.round(p)}% read` : `${readingTime(book)} min read`;
  }

  function bookCard(book, simple = false) {
    const tag = book.kind === 'published' ? 'a' : 'button';
    const attrs = book.kind === 'published'
      ? `href="${attr(book.url)}" target="_blank" rel="noopener noreferrer"`
      : `type="button" data-read="${attr(book.id)}"`;
    return `
      <${tag} class="story-card ${simple ? 'simple' : ''}" ${attrs}>
        ${simple ? '' : cover(book)}
        <div>
          <div class="meta"><span>${book.kind === 'folktale' ? 'Folktale' : book.kind === 'published' ? 'Published' : book.kind === 'imported' ? 'Imported' : 'Original'}</span><span>${escape(progressLabel(book))}</span></div>
          <h3 lang="ko">${escape(book.title)}</h3>
          <p class="english">${escape(book.english || (book.author ? `By ${book.author}` : 'My book'))}</p>
          <p class="desc">${escape(book.description || '')}</p>
        </div>
      </${tag}>
    `;
  }

  function renderHome() {
    const recent = readable(findBook(state.lastRead)) ? findBook(state.lastRead) : builtIn[0];
    const recs = allBooks().filter(b => b.id !== recent.id).slice(0, 4);
    screen.innerHTML = `
      <section class="hero">
        <div>
          <span class="eyebrow">책숲</span>
          <h1>작은 책, 쉬운 시작.</h1>
          <p class="section-intro">Open a story, scroll, and read Korean one small step at a time.</p>
          <button class="big-btn primary" type="button" data-read="${attr(recent.id)}">${state.lastRead ? 'Continue reading' : 'Start reading'} ${icon('right')}</button>
        </div>
        <div class="hero-bunny">
          <img src="${bunnyImg}" alt="Cute bunny icon for 책숲">
        </div>
      </section>

      <div class="mini-grid">
        <div class="mini-card"><b>${state.complete.length}</b><span>Books finished</span></div>
        <div class="mini-card"><b>${Object.keys(state.words).length}</b><span>Saved words</span></div>
        <div class="mini-card"><b>${state.days.length}</b><span>Reading days</span></div>
      </div>

      <div class="section-head"><div><h2>Pick a shelf</h2><p class="section-intro">Big buttons. Simple choices.</p></div></div>
      <div class="shelf-grid">
        <button class="shelf-btn" type="button" data-kind="original">
          <span class="left"><span class="bubble">🐰</span><span><b>쉬운 이야기</b><br><small>Original graded stories</small></span></span>
          ${icon('right')}
        </button>
        <button class="shelf-btn" type="button" data-kind="folktale">
          <span class="left"><span class="bubble">🌙</span><span><b>전래동화</b><br><small>Korean folktales</small></span></span>
          ${icon('right')}
        </button>
        <button class="shelf-btn" type="button" data-kind="published">
          <span class="left"><span class="bubble">📚</span><span><b>실제 동화책</b><br><small>Published books</small></span></span>
          ${icon('right')}
        </button>
      </div>

      <div class="section-head"><div><h2>Continue with this story</h2></div></div>
      ${bookCard(recent)}

      <div class="section-head">
        <div><h2>Try one next</h2><p class="section-intro">A few gentle recommendations.</p></div>
        <button class="text-link" type="button" data-go="library">See all ${icon('right')}</button>
      </div>
      <div class="story-list">${recs.map(book => bookCard(book)).join('')}</div>
    `;
  }

  function libraryBookFilter(book) {
    const kindOk = state.libraryKind === 'all' || book.kind === state.libraryKind;
    const levelOk = state.libraryLevel === 'all' || String(book.level) === String(state.libraryLevel);
    const text = `${book.title || ''} ${book.english || ''} ${book.description || ''}`.toLowerCase();
    const searchOk = !searchQuery || text.includes(searchQuery.toLowerCase());
    return kindOk && levelOk && searchOk;
  }

  function renderLibraryResults() {
    const list = allBooks().filter(libraryBookFilter);
    const holder = $('#library-results');
    const count = $('#library-count');
    if (count) count.textContent = state.libraryKind === 'all' && state.libraryLevel === 'all' && !searchQuery
      ? `All ${list.length} books`
      : `${list.length} books`;
    if (!holder) return;
    holder.innerHTML = list.length ? `<div class="story-list">${list.map(book => bookCard(book)).join('')}</div>` : `
      <div class="empty-state">
        <img src="${bunnyImg}" class="big-bunny" alt="Bunny icon">
        <h3>No books found</h3>
        <p>Try another shelf, level, or search word.</p>
        <button type="button" class="btn small" id="reset-filters">Reset</button>
      </div>`;
  }

  function renderLibrary() {
    screen.innerHTML = `
      <section>
        <span class="eyebrow">Library</span>
        <h1>나의 서재</h1>
        <p class="section-intro">Read inside 책숲 or open published Korean books on their original websites.</p>
      </section>

      <label class="search-bar">
        ${icon('search')}
        <input id="library-search" type="search" placeholder="Search stories" value="${attr(searchQuery)}" autocomplete="off">
      </label>

      <div class="filter-row" aria-label="Shelf filter">
        ${Object.entries(kinds).map(([key, label]) => `<button type="button" class="chip ${state.libraryKind === key ? 'active' : ''}" data-filter="${key}">${escape(label)}</button>`).join('')}
      </div>

      <div class="filter-row" aria-label="Level filter">
        <button type="button" class="chip ${state.libraryLevel === 'all' ? 'active' : ''}" data-level="all">Any level</button>
        ${Object.keys(levels).map(level => `<button type="button" class="chip ${String(state.libraryLevel) === level ? 'active' : ''}" data-level="${level}">Level ${level}</button>`).join('')}
      </div>

      <div class="section-head">
        <div><h2 id="library-count"></h2></div>
        <button type="button" class="btn small" data-import="1">${icon('plus')} Import</button>
      </div>
      <div id="library-results"></div>
      <div class="help-card"><b>Published books:</b> These open on the original site and may need internet. Original stories, folktales, and your own imports can be read offline after the app is loaded.</div>
    `;
    renderLibraryResults();
  }

  function getGlossary(book, token) {
    const clean = token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    const list = book?.glossary || [];
    return list.find(g => g.word === clean) || list.filter(g => clean.includes(g.word) || g.word.includes(clean)).sort((a, b) => b.word.length - a.word.length)[0] || null;
  }

  function tokens(text, book, paragraphIndex) {
    return String(text).split(/(\s+)/u).map(chunk => {
      if (!/[가-힣]/u.test(chunk)) return escape(chunk);
      const plain = chunk.replace(/^[^가-힣]+|[^가-힣]+$/g, '');
      if (!plain) return escape(chunk);
      const canGloss = !!getGlossary(book, plain);
      return `<span class="token ${canGloss ? 'glossable' : ''}" data-word="${attr(plain)}" data-paragraph-index="${paragraphIndex}" tabindex="0" role="button" aria-label="Look up ${attr(plain)}">${escape(chunk)}</span>`;
    }).join('');
  }

  function renderParagraph(book, paragraph, index) {
    const showTranslation = state.translation === 'all' || visibleTrans.has(index);
    const canToggle = !!paragraph.en && state.translation !== 'off';
    return `
      <article class="reader-card">
        <div class="korean" lang="ko">${tokens(paragraph.ko, book, index)}</div>
        ${showTranslation && paragraph.en ? `<div class="reader-translation">${escape(paragraph.en)}</div>` : ''}
        <div class="row-line">
          ${canToggle ? `<button type="button" class="btn small" data-translate-one="${index}">${showTranslation ? 'Hide English' : 'Show English'}</button>` : '<span></span>'}
          <button type="button" class="btn small outline" data-speak-one="${index}">${icon('sound')} Hear</button>
        </div>
      </article>
    `;
  }

  function renderReader(book) {
    readerId = book.id;
    state.lastRead = book.id;
    markDay();
    save();
    document.body.classList.add('reader-open');

    const helperLabel = state.translation === 'off' ? 'English off' : state.translation === 'tap' ? 'English tap' : 'English on';
    const finished = isComplete(book.id);

    screen.innerHTML = `
      <div class="reader-head">
        <button type="button" class="circle-btn" data-go="${readingReturnRoute}" aria-label="Back">${icon('arrow')}</button>
        <div class="reader-title">
          <h1 lang="ko">${escape(book.title)}</h1>
          <p>${levels[book.level]} · ${readingTime(book)} min · ${finished ? 'Finished' : progressLabel(book)}</p>
        </div>
      </div>

      <div class="reader-tools">
        <button type="button" class="tool-btn" id="translation-mode">${icon('book')}<span>${helperLabel}</span></button>
        <button type="button" class="tool-btn" id="read-aloud">${icon('sound')}<span id="speech-label">Listen</span></button>
        <button type="button" class="tool-btn" id="font-toggle">A<span>${state.fontSize}px</span></button>
        <button type="button" class="tool-btn" id="favorite-toggle">${icon('bookmark')}<span>${isFavorite(book.id) ? 'Saved' : 'Save'}</span></button>
      </div>
      <div id="speech-help" class="help-card" role="status" hidden></div>

      ${book.paragraphs.map((p, i) => renderParagraph(book, p, i)).join('')}

      <div class="reader-footer">
        <button type="button" class="big-btn ${finished ? 'outline' : 'primary'}" id="mark-finished">${finished ? '↩ Mark as unfinished' : `${icon('check')} Mark finished`}</button>
      </div>
    `;

    setTimeout(() => {
      const y = state.positions[book.id] || 0;
      if (y > 0) window.scrollTo(0, y);
      else window.scrollTo(0, 0);
    }, 0);
  }

  function renderWords() {
    const words = Object.entries(state.words).sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0));
    screen.innerHTML = `
      <section>
        <span class="eyebrow">Words</span>
        <h1>나의 단어장</h1>
        <p class="section-intro">Tap Korean words while reading to save them here.</p>
      </section>
      ${words.length ? `<div class="story-list">${words.map(([word, info]) => `
        <div class="word-card">
          <div class="row-line"><h3 lang="ko">${escape(word)}</h3><button type="button" class="btn small outline" data-remove-word="${attr(word)}">Remove</button></div>
          <p>${escape(info.meaning || 'Saved word')}</p>
          ${info.note ? `<p>${escape(info.note)}</p>` : ''}
          ${info.context ? `<div class="context" lang="ko">${escape(info.context)}</div>` : ''}
        </div>`).join('')}</div>` : `
        <div class="empty-state">
          <img src="${bunnyImg}" class="big-bunny" alt="Bunny icon">
          <h3>No saved words yet</h3>
          <p>Open a story and tap a word to start your word list.</p>
          <button type="button" class="btn primary" data-go="library">Go to books</button>
        </div>`}
    `;
  }

  function renderSettings() {
    screen.innerHTML = `
      <section>
        <span class="eyebrow">Settings</span>
        <h1>설정</h1>
        <p class="section-intro">Keep everything simple. Change only what you need.</p>
      </section>

      <div class="setting-grid">
        <div class="setting-card">
          <label for="setting-theme">Theme</label>
          <select id="setting-theme">
            <option value="light" ${state.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${state.theme === 'dark' ? 'selected' : ''}>Dark</option>
          </select>
        </div>

        <div class="setting-card">
          <label for="setting-font">Text size · ${state.fontSize}px</label>
          <input id="setting-font" type="range" min="17" max="30" step="1" value="${state.fontSize}">
        </div>

        <div class="setting-card">
          <label for="setting-translation">English help</label>
          <select id="setting-translation">
            <option value="off" ${state.translation === 'off' ? 'selected' : ''}>Off</option>
            <option value="tap" ${state.translation === 'tap' ? 'selected' : ''}>Tap for English</option>
            <option value="all" ${state.translation === 'all' ? 'selected' : ''}>Show all English</option>
          </select>
        </div>

        <div class="setting-card">
          <label for="setting-rate">Speech speed</label>
          <select id="setting-rate">
            <option value="0.8" ${String(state.speechRate) === '0.8' ? 'selected' : ''}>Slow</option>
            <option value="0.9" ${String(state.speechRate) === '0.9' ? 'selected' : ''}>Normal</option>
            <option value="1" ${String(state.speechRate) === '1' ? 'selected' : ''}>Fast</option>
          </select>
        </div>

        <div class="setting-card">
          <h3>Add or back up books</h3>
          <div class="row-buttons">
            <button type="button" class="btn" data-import="1">${icon('plus')} Import book</button>
            <button type="button" class="btn" id="backup-export">${icon('download')} Export backup</button>
            <button type="button" class="btn" id="backup-restore">${icon('upload')} Restore backup</button>
          </div>
        </div>

        <div class="setting-card">
          <h3>Korean audio 🔊</h3>
          <p class="desc" id="speech-diagnostic">${escape(speechDiagnostic || 'Built-in books use recorded Korean audio that plays like music, even with the iPhone in Silent Mode. Tap Test voice.')}</p>
          <button class="btn primary" type="button" id="test-korean-voice">${icon('sound')} Test voice</button>
        </div>
        <div class="setting-card">
          <h3>Offline Korean audio</h3>
          <p class="desc" id="offline-audio-status">Save built-in story audio once to listen without internet.</p>
          <button class="btn" type="button" id="cache-korean-audio">${icon('download')} Save offline audio</button>
        </div>
        <div class="help-card">
          <b>Offline note:</b> The stories inside 책숲 are stored in the app. Published books still open from their original websites, so those may need internet.
        </div>
      </div>
    `;
  }

  // Ignore old speech errors when the reader cancels or replaces an utterance.
  let speechRun = 0;
  let currentUtterance = null;
  let currentAudio = null;
  let speechDiagnostic = '';

  function stopSpeech() {
    speechRun++;
    if (currentAudio) {
      const audio = currentAudio;
      currentAudio = null;
      audio.onended = null;
      audio.onerror = null;
      try { audio.pause(); } catch (_) {}
    }
    const synth = window.speechSynthesis;
    const hadSpeech = !!currentUtterance || speaking || !!synth?.speaking || !!synth?.pending;
    currentUtterance = null;
    speaking = false;
    speakSequence = [];
    if (hadSpeech && synth) synth.cancel();
    restoreAudioChannel();
    const label = $('#speech-label');
    if (label) label.textContent = 'Listen';
  }

  // iPhone's silent switch can mute Web Speech even at high media volume.
  // Request the media playback category before starting user-initiated speech.
  // This API is progressive enhancement: older browsers may not support it.
  function useMediaAudioChannel() {
    try {
      if (navigator.audioSession && navigator.audioSession.type !== 'playback') {
        navigator.audioSession.type = 'playback';
      }
    } catch (error) {
      console.warn('Unable to set playback audio session:', error);
    }
  }

  function restoreAudioChannel() {
    try {
      if (navigator.audioSession && navigator.audioSession.type === 'playback') {
        navigator.audioSession.type = 'auto';
      }
    } catch (error) {
      console.warn('Unable to reset playback audio session:', error);
    }
  }

  function speechVoice() {
    if (!('speechSynthesis' in window)) return null;
    // Prefer locally installed Korean voices. iOS otherwise chooses by lang.
    return window.speechSynthesis.getVoices().find(v => /^ko[-_]/i.test(v.lang || '') && v.localService) || null;
  }

  function speechFailed(reason) {
    const code = reason || 'unknown';
    if (code === 'canceled' || code === 'interrupted') return;
    console.warn('책숲 speech failed:', code);
    const message = code === 'recording-unavailable'
      ? 'Recorded Korean audio is not ready yet. Connect to the internet and save the offline audio in Settings.'
      : ['language-unavailable','voice-unavailable','synthesis-unavailable'].includes(code)
      ? 'The browser could not start Korean speech. Check the selected Korean voice or try Safari.'
      : code === 'not-allowed'
        ? 'iOS blocked audio. Tap Hear again after opening the app directly.'
        : code === 'audio-busy' || code === 'audio-hardware'
          ? 'Your speaker is busy. Check connected headphones and other audio.'
          : 'Korean speech did not start. If the iPhone is in Silent Mode, try turning it off; the browser may restrict speech audio.';
    speechDiagnostic = message + ' (' + code + ')';
    toast('Speech error: ' + code);
    const help = $('#speech-help');
    if (help) { help.hidden = false; help.textContent = speechDiagnostic; }
    const settingsHelp = $('#speech-diagnostic');
    if (settingsHelp) settingsHelp.textContent = speechDiagnostic;
  }

  function makeUtterance(text, run) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = Number(state.speechRate) || 0.9;
    const voice = speechVoice();
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      if (run !== speechRun) return;
      speechDiagnostic = '';
      const help = $('#speech-help');
      if (help) help.hidden = true;
      const settingsHelp = $('#speech-diagnostic');
      if (settingsHelp) settingsHelp.textContent = 'Korean voice started successfully.';
    };
    return utterance;
  }

  function playRecorded(path, fullStory = false) {
    if (!path || !('Audio' in window)) return false;
    stopSpeech();
    useMediaAudioChannel();
    const run = ++speechRun;
    try {
      const audio = new Audio(new URL(path, document.baseURI).href);
      audio.preload = 'auto';
      audio.volume = 1;
      currentAudio = audio;
      speaking = fullStory;
      const label = $('#speech-label');
      if (label && fullStory) label.textContent = 'Stop';
      audio.onended = () => {
        if (run !== speechRun) return;
        currentAudio = null;
        speaking = false;
        if (label) label.textContent = 'Listen';
        restoreAudioChannel();
      };
      audio.onerror = () => {
        if (run !== speechRun) return;
        stopSpeech();
        speechFailed('recording-unavailable');
      };
      const playing = audio.play();
      if (playing && typeof playing.catch === 'function') {
        playing.catch(error => {
          if (run !== speechRun) return;
          stopSpeech();
          speechFailed(error?.name === 'NotAllowedError' ? 'not-allowed' : 'recording-unavailable');
        });
      }
      return true;
    } catch (error) {
      stopSpeech();
      console.warn('Korean recorded audio playback failed:', error);
      speechFailed('recording-unavailable');
      return true;
    }
  }

  function speak(text, recordedPath = null) {
    if (recordedPath && playRecorded(recordedPath)) return;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      speechFailed('synthesis-unavailable'); return;
    }
    stopSpeech();
    useMediaAudioChannel();
    const run = ++speechRun;
    try {
      const utterance = makeUtterance(text, run);
      currentUtterance = utterance;
      utterance.onend = () => {
        if (run !== speechRun) return;
        currentUtterance = null;
        restoreAudioChannel();
      };
      utterance.onerror = e => {
        if (run !== speechRun) return;
        currentUtterance = null;
        restoreAudioChannel();
        speechFailed(e.error);
      };
      // Do not delay this call: iOS requires direct user interaction.
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      currentUtterance = null;
      restoreAudioChannel();
      speechFailed('synthesis-failed');
      console.warn('Speech exception:', e);
    }
  }

  function speakAll() {
    if (speaking) { stopSpeech(); return; }
    const book = findBook(readerId);
    if (!book) return;
    const recorded = window.CHAEKSOOP_AUDIO?.complete?.[book.id];
    if (recorded && playRecorded(recorded, true)) return;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      speechFailed('synthesis-unavailable'); return;
    }
    stopSpeech();
    useMediaAudioChannel();
    const run = ++speechRun;
    speaking = true;
    speakSequence = book.paragraphs.map(p => p.ko);
    const label = $('#speech-label');
    if (label) label.textContent = 'Stop';
    const next = () => {
      if (run !== speechRun || !speaking) return;
      if (!speakSequence.length) { stopSpeech(); return; }
      try {
        const utterance = makeUtterance(speakSequence.shift(), run);
        currentUtterance = utterance;
        utterance.onend = () => {
          if (run !== speechRun) return;
          currentUtterance = null;
          next();
        };
        utterance.onerror = event => {
          if (run !== speechRun) return;
          const code = event.error;
          stopSpeech();
          speechFailed(code);
        };
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        stopSpeech();
        speechFailed('synthesis-failed');
        console.warn('Story speech exception:', e);
      }
    };
    next();
  }

  function cycleFontSize() {
    const sizes = [19, 21, 24, 27];
    const index = sizes.indexOf(Number(state.fontSize));
    state.fontSize = sizes[(index + 1) % sizes.length] || 21;
    save();
    setTheme();
  }

  function wordDialog(token, paragraph) {
    const book = findBook(readerId);
    const gloss = getGlossary(book, token);
    const entry = state.words[token];
    vocabSelected = { token, gloss, source: book?.title || '', context: paragraph || '' };
    const url = 'https://ko.dict.naver.com/#/search?query=' + encodeURIComponent(token);
    $('#word-content').innerHTML = `
      <div class="word-detail">
        <div class="word-detail-head">
          <span class="eyebrow">Word</span>
          <button class="circle-btn" type="button" data-close-dialog="word-dialog" aria-label="Close">${icon('close')}</button>
        </div>
        <h2 id="word-heading" lang="ko">${escape(token)}</h2>
        <p class="meaning">${gloss ? escape(gloss.meaning) : 'Not in this story glossary yet.'}</p>
        ${gloss?.note ? `<p class="note">${escape(gloss.note)}</p>` : ''}
        <div class="context" lang="ko">${escape(paragraph || '')}</div>
        <div class="word-actions">
          <button type="button" class="btn primary" id="save-word">${icon('bookmark')} ${entry ? 'Remove word' : 'Save word'}</button>
          <button type="button" class="btn" id="speak-word">${icon('sound')} Hear word</button>
        </div>
        <a class="dictionary-link" href="${attr(url)}" target="_blank" rel="noopener noreferrer">Open online dictionary ${icon('external')}</a>
      </div>
    `;
    $('#word-dialog').showModal();
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({format:'chaeksoop-backup-v1', exportedAt:new Date().toISOString(), state}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chaeksoop-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Backup exported.');
  }

  function validateImport(data) {
    if (!data || typeof data !== 'object' || data.format !== 'chaeksoop-backup-v1' || !data.state) throw new Error('Not a 책숲 backup');
    const next = {...initial, ...data.state};
    if (!Array.isArray(next.imported) || !Array.isArray(next.complete) || typeof next.words !== 'object') throw new Error('Backup is missing required data');
    next.imported = next.imported.filter(b => b && typeof b.title === 'string' && Array.isArray(b.paragraphs) && b.paragraphs.every(p => typeof p.ko === 'string')).slice(0, 200);
    return next;
  }

  function openImport() { $('#import-dialog').showModal(); }

  function handleImport() {
    const title = $('#import-title').value.trim();
    const author = $('#import-author').value.trim();
    const level = Number($('#import-level').value);
    const text = $('#import-text').value.trim();
    if (!title) { toast('Please add a title.'); return; }
    if (text.length < 10) { toast('Please paste a longer Korean story.'); return; }
    if (text.length > 100000) { toast('This file is too large.'); return; }
    if (state.imported.length >= 100) { toast('Limit of 100 imported books. Export a backup first.'); return; }
    const paragraphs = text.split(/\n\s*\n/g).map(p => p.trim()).filter(Boolean).flatMap(p => p.length > 1200 ? (p.match(/[\s\S]{1,1100}/g) || []) : [p]);
    const book = {
      id: 'import-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
      title,
      english: author ? `By ${author}` : 'My imported story',
      author,
      level,
      kind:'imported',
      theme:['sage','peach','lavender','rain'][level - 1] || 'sage',
      emoji:'📜',
      description:'Imported personal Korean reading text.',
      paragraphs: paragraphs.map(ko => ({ko, en:''})),
      glossary:[]
    };
    state.imported.unshift(book);
    save();
    $('#import-dialog').close();
    $('#import-form').reset();
    toast('Story added.');
    goto('read/' + book.id);
  }

  function updateReaderProgress() {
    if (!readerId) return;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    state.positions[readerId] = Math.round(window.scrollY);
    state.progress[readerId] = isComplete(readerId) ? 100 : Math.max(state.progress[readerId] || 0, Math.min(99, Math.round((window.scrollY / max) * 100)));
    save();
  }

  function trackScroll() {
    if (!readerId) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(updateReaderProgress, 180);
  }

  function render() {
    setTheme();
    const parts = decodeURIComponent((location.hash || '#home').replace(/^#/, '')).split('/');
    const page = parts[0] || 'home';
    readerId = null;
    stopSpeech();
    document.body.classList.remove('reader-open');

    if (page === 'read') {
      const book = findBook(parts[1]);
      if (readable(book)) {
        if (displayedBookId !== book.id) { visibleTrans.clear(); displayedBookId = book.id; }
        routeName = 'read';
        renderReader(book);
        return;
      }
      goto('library');
      return;
    }

    routeName = ['home', 'library', 'words', 'settings'].includes(page) ? page : 'home';
    syncNav(routeName);

    if (routeName === 'home') renderHome();
    else if (routeName === 'library') renderLibrary();
    else if (routeName === 'words') renderWords();
    else renderSettings();

    window.scrollTo(0, 0);
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('button, .token');
    if (!target) return;

    if (target.dataset.go) { goto(target.dataset.go); return; }
    if (target.dataset.read) { goto('read/' + target.dataset.read); return; }
    if (target.dataset.kind) {
      state.libraryKind = target.dataset.kind;
      state.libraryLevel = 'all';
      searchQuery = '';
      save();
      goto('library');
      return;
    }
    if (target.dataset.filter) {
      state.libraryKind = target.dataset.filter;
      // Selecting All must clear BOTH hidden constraints.
      if (state.libraryKind === 'all') {
        state.libraryLevel = 'all';
        searchQuery = '';
      }
      save();
      renderLibrary();
      return;
    }
    if (target.dataset.level !== undefined) {
      state.libraryLevel = target.dataset.level;
      save();
      renderLibrary();
      return;
    }
    if (target.dataset.import) { openImport(); return; }
    if (target.dataset.closeDialog) { document.getElementById(target.dataset.closeDialog).close(); return; }
    if (target.dataset.word) {
      const book = findBook(readerId);
      const context = book?.paragraphs?.[Number(target.dataset.paragraphIndex)]?.ko || '';
      wordDialog(target.dataset.word, context);
      return;
    }
    if (target.dataset.translateOne !== undefined) {
      const index = Number(target.dataset.translateOne);
      const card = target.closest('.reader-card');
      const paragraph = findBook(readerId)?.paragraphs?.[index];
      if (!card || !paragraph?.en) return;
      if (visibleTrans.has(index)) {
        visibleTrans.delete(index);
        card.querySelector('.reader-translation')?.remove();
        target.textContent = 'Show English';
      } else {
        visibleTrans.add(index);
        const translation = document.createElement('div');
        translation.className = 'reader-translation';
        translation.textContent = paragraph.en;
        card.querySelector('.korean').after(translation);
        target.textContent = 'Hide English';
      }
      return;
    }
    if (target.dataset.speakOne !== undefined) {
      const book = findBook(readerId);
      const paragraph = book?.paragraphs?.[Number(target.dataset.speakOne)];
      if (paragraph) {
        const recorded = window.CHAEKSOOP_AUDIO?.paragraphs?.[book.id]?.[Number(target.dataset.speakOne)] || null;
        speak(paragraph.ko, recorded);
      }
      return;
    }
    if (target.dataset.removeWord) {
      delete state.words[target.dataset.removeWord];
      save();
      renderWords();
      toast('Word removed.');
      return;
    }

    switch (target.id) {
      case 'top-settings':
        goto('settings');
        break;
      case 'reset-filters':
        state.libraryKind = 'all';
        state.libraryLevel = 'all';
        searchQuery = '';
        save();
        renderLibrary();
        break;
      case 'translation-mode':
        state.translation = state.translation === 'off' ? 'tap' : state.translation === 'tap' ? 'all' : 'off';
        save();
        renderReader(findBook(readerId));
        toast('English help: ' + state.translation);
        break;
      case 'read-aloud':
        speakAll();
        break;
      case 'test-korean-voice':
        speak('안녕하세요. 책숲에서 한국어를 읽어요.', window.CHAEKSOOP_AUDIO?.test || null);
        break;
      case 'cache-korean-audio':
        if (!('serviceWorker' in navigator)) {
          toast('Offline caching is unavailable in this browser.');
          break;
        }
        navigator.serviceWorker.ready.then(registration => {
          const worker = registration.active || navigator.serviceWorker.controller;
          if (!worker) throw new Error('Offline worker is not running');
          worker.postMessage({type:'CACHE_KOREAN_AUDIO'});
          const status = $('#offline-audio-status');
          if (status) status.textContent = 'Saving audio… Keep 책숲 open and connected.';
        }).catch(() => toast('Could not start audio download. Try again online.'));
        break;
      case 'font-toggle':
        cycleFontSize();
        target.querySelector('span').textContent = state.fontSize + 'px';
        break;
      case 'favorite-toggle': {
        const id = readerId;
        state.favorites = isFavorite(id) ? state.favorites.filter(x => x !== id) : [...state.favorites, id];
        save();
        target.querySelector('span').textContent = isFavorite(id) ? 'Saved' : 'Save';
        toast(isFavorite(id) ? 'Saved.' : 'Removed.');
        break;
      }
      case 'mark-finished': {
        const id = readerId;
        const wasFinished = isComplete(id);
        if (wasFinished) {
          state.complete = state.complete.filter(bookId => bookId !== id);
          state.progress[id] = 0;
          state.positions[id] = 0;
        } else {
          state.complete.push(id);
          state.progress[id] = 100;
          markDay();
        }
        save();
        renderReader(findBook(id));
        toast(wasFinished ? 'Marked as unfinished.' : 'Story finished! 잘했어요!');
        break;
      }
      case 'save-word': {
        const word = vocabSelected;
        if (!word) return;
        if (state.words[word.token]) delete state.words[word.token];
        else state.words[word.token] = {
          meaning: word.gloss?.meaning || '',
          note: word.gloss?.note || '',
          source: word.source,
          context: word.context,
          savedAt: Date.now()
        };
        save();
        $('#word-dialog').close();
        toast(state.words[word.token] ? 'Word saved.' : 'Word removed.');
        break;
      }
      case 'speak-word':
        if (vocabSelected) {
          const recorded = window.CHAEKSOOP_AUDIO?.words?.[vocabSelected.token] || null;
          speak(vocabSelected.token, recorded);
        }
        break;
      case 'backup-export':
        exportBackup();
        break;
      case 'backup-restore':
        $('#restore-file').click();
        break;
    }
  });

  document.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('token')) {
      event.preventDefault();
      event.target.click();
    }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'library-search') {
      searchQuery = event.target.value;
      renderLibraryResults();
    }
    if (event.target.id === 'setting-font') {
      state.fontSize = Number(event.target.value);
      save();
      setTheme();
      const label = document.querySelector('label[for="setting-font"]');
      if (label) label.textContent = 'Text size · ' + state.fontSize + 'px';
    }
  });

  document.addEventListener('change', event => {
    const id = event.target.id;
    if (id === 'setting-theme') {
      state.theme = event.target.value;
      save();
      setTheme();
      renderSettings();
    } else if (id === 'setting-translation') {
      state.translation = event.target.value;
      save();
    } else if (id === 'setting-rate') {
      state.speechRate = Number(event.target.value);
      save();
    } else if (id === 'import-file') {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 400000) { toast('File is too large.'); return; }
      file.text().then(text => {
        if (!$('#import-title').value.trim()) $('#import-title').value = file.name.replace(/\.txt$/i, '');
        $('#import-text').value = text;
        toast('Text loaded.');
      }).catch(() => toast('Could not read that file.'));
    } else if (id === 'restore-file') {
      const file = event.target.files?.[0];
      if (!file) return;
      file.text().then(text => {
        const next = validateImport(JSON.parse(text));
        if (confirm('Restore this backup? Your current reading data will be replaced.')) {
          state = next;
          save();
          render();
          toast('Backup restored.');
        }
      }).catch(err => toast('Could not restore: ' + err.message));
      event.target.value = '';
    }
  });

  $('#import-form').addEventListener('submit', event => {
    event.preventDefault();
    handleImport();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      const detail = event.data;
      if (!detail || !detail.type?.startsWith('KOREAN_AUDIO_')) return;
      const status = $('#offline-audio-status');
      if (detail.type === 'KOREAN_AUDIO_PROGRESS') {
        if (status) status.textContent = `Saving Korean audio: ${detail.done} of ${detail.total}`;
      } else if (detail.type === 'KOREAN_AUDIO_COMPLETE') {
        if (status) status.textContent = detail.failed
          ? `Saved ${detail.done} audio clips. ${detail.failed} could not be saved; try again online.`
          : `All ${detail.done} Korean audio clips are saved offline! 🐰`;
        toast(detail.failed ? 'Some audio files need another download.' : 'Offline Korean audio is ready!');
      } else if (detail.type === 'KOREAN_AUDIO_ERROR') {
        if (status) status.textContent = detail.message || 'Could not save audio. Try again online.';
        toast('Offline audio download failed.');
      }
    });
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('scroll', trackScroll, {passive:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeech(); });

  render();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => console.warn('Service worker registration failed.')));
  }
})();