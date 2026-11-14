
'use strict';

function updateLyricsBadge(type) {}
window.updateLyricsBadge = updateLyricsBadge;

  function setRightPanelLyricsEmptySmooth(isEmpty) {
    const panel = el.rightPanel || document.getElementById('right-panel');
    const card = document.getElementById('rp-credits-card');
    if (panel) panel.classList.toggle('lyrics-empty', !!isEmpty);
    if (!isEmpty) {
      if (!isLyricsFullscreenOnly()) {
        if (card) {
          card.classList.add('hidden');
          card.innerHTML = '';
        }
        if (panel) panel.classList.remove('has-credits');
        if (el.rightPanel) el.rightPanel.classList.remove('has-credits');
      } else {
        if (state.currentTrack) updateRightPanelCredits(state.currentTrack);
      }
    } else {
      if (state.currentTrack) updateRightPanelCredits(state.currentTrack);
    }
    if (typeof renderMiniLyrics === 'function') renderMiniLyrics();
    if (!panel) return;
    const currentlyEmpty = panel.classList.contains('lyrics-empty');
    if (currentlyEmpty === !!isEmpty) {
      if (typeof syncTvLayout === 'function') syncTvLayout(!!isEmpty);
      return;
    }

    const artworkBox = el.rightPanelArtworkBox || document.getElementById('right-panel-artwork-box');
    const headerActions = panel.querySelector('.lyrics-header-actions') || document.querySelector('.lyrics-header-actions');

    const elementsToAnimate = [artworkBox, headerActions].filter(Boolean);
    const firstTops = new Map();
    elementsToAnimate.forEach(elem => {
      firstTops.set(elem, elem.getBoundingClientRect().top);
    });

    panel.classList.toggle('lyrics-empty', !!isEmpty);
    if (typeof syncTvLayout === 'function') syncTvLayout(!!isEmpty);

    if (document.body.classList.contains('perf')) return;

    const animatedItems = [];
    elementsToAnimate.forEach(elem => {
      const firstTop = firstTops.get(elem);
      const lastTop = elem.getBoundingClientRect().top;
      const deltaY = firstTop - lastTop;
      if (Math.abs(deltaY) > 0.5) {
        elem.style.transition = 'none';
        elem.style.transform = `translateY(${deltaY}px)`;
        animatedItems.push(elem);
      }
    });

    if (animatedItems.length === 0) return;

    animatedItems.forEach(elem => elem.offsetHeight);

    requestAnimationFrame(() => {
      animatedItems.forEach(elem => {
        elem.style.transition = 'transform 320ms cubic-bezier(0.2, 0, 0, 1)';
        elem.style.transform = 'translateY(0)';

        let cleaned = false;
        const cleanUp = () => {
          if (cleaned) return;
          cleaned = true;
          elem.removeEventListener('transitionend', onEnd);
          elem.style.transition = '';
          elem.style.transform = '';
        };
        const onEnd = (e) => {
          if (e.target !== elem || e.propertyName !== 'transform') return;
          cleanUp();
        };
        elem.addEventListener('transitionend', onEnd);
        setTimeout(cleanUp, 380);
      });
    });
  }


  function setLyricsEmpty(isEmpty) {
    setRightPanelLyricsEmptySmooth(isEmpty);
  }

  var lyricsSessionCache = new Map();
  var wordsSessionCache = new Map();

  [lyricsSessionCache, wordsSessionCache].forEach(m => {
    const origSet = m.set.bind(m);
    m.set = function(k, v) {
      const res = origSet(k, v);
      boundMap(m, 30);
      return res;
    };
  });

  function parseEnhancedLrcWords(lineStr, lineStart, lineEnd) {
    const tagRegex = /<(\d+):(\d+(?:\.\d+)?)>/g;
    let m;
    const tags = [];
    while ((m = tagRegex.exec(lineStr)) !== null) {
      const min = parseInt(m[1], 10);
      const sec = parseFloat(m[2]);
      tags.push({ time: min * 60 + sec, startIdx: m.index, endIdx: m.index + m[0].length });
    }
    if (tags.length === 0) return null;
    const words = [];
    for (let i = 0; i < tags.length; i++) {
      const cur = tags[i];
      const nxt = tags[i + 1];
      const wText = lineStr.substring(cur.endIdx, nxt ? nxt.startIdx : lineStr.length).trim();
      if (wText) {
        const wStart = cur.time;
        const wEnd = nxt ? nxt.time : (lineEnd > wStart ? lineEnd : wStart + 0.5);
        words.push({ text: wText, start: wStart, end: wEnd });
      }
    }
    return words.length > 0 ? words : null;
  }

  function stringNormalizedSimilarity(a, b) {
    const normA = (a || '').toLowerCase().replace(/[^a-z0-9\u0400-\u04ff\u4e00-\u9fa5]/gi, '');
    const normB = (b || '').toLowerCase().replace(/[^a-z0-9\u0400-\u04ff\u4e00-\u9fa5]/gi, '');
    if (!normA && !normB) return 1;
    if (!normA || !normB) return 0;
    if (normA === normB) return 1;
    if (normA.includes(normB) || normB.includes(normA)) {
      return Math.min(normA.length, normB.length) / Math.max(normA.length, normB.length);
    }
    let common = 0;
    const minLen = Math.min(normA.length, normB.length);
    for (let i = 0; i < minLen; i++) {
      if (normA[i] === normB[i]) common++;
    }
    return common / Math.max(normA.length, normB.length);
  }

  async function fetchAndUpgradeWords(title, artist, trackId, token) {
    const wordSource = localStorage.getItem('riff_word_source') || 'auto';
    if (wordSource === 'estimate') return;

    const cachedWords = wordsSessionCache.get(trackId);
    if (cachedWords) {
      if (cachedWords.negative) {
        if (Date.now() - cachedWords.time < 600000) return;
      } else if (cachedWords.wordsByLine) {
        if (token !== state.loadToken || !state.currentTrack || (((state.currentTrack.id) || `${artist}:${title}`) !== trackId)) return;
        state.syncedLyrics.forEach((line, index) => {
          if (cachedWords.wordsByLine[index]) line.words = cachedWords.wordsByLine[index];
        });
        upgradeLyricsWordsInPlace();
        return;
      }
    }

    try {
      const duration = (state.currentTrack && state.currentTrack.duration) || (el.nativeAudio && el.nativeAudio.duration) || 0;
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/lyrics-words?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&duration=${encodeURIComponent(duration || '')}`);
      const data = await res.json();

      if (token !== state.loadToken || !state.currentTrack || (((state.currentTrack.id) || `${artist}:${title}`) !== trackId)) return;
      if (!data || !data.success || !data.lines || data.lines.length === 0) {
        wordsSessionCache.set(trackId, { negative: true, time: Date.now() });
        return;
      }

      const hasSync = state.syncedLyrics && state.syncedLyrics.some(p => p.time >= 0);
      if (state.isCustomLyrics && !hasSync) return;
      if (hasSync) {
        const countDiff = Math.abs(state.syncedLyrics.length - data.lines.length) / Math.max(state.syncedLyrics.length, data.lines.length);
        if (countDiff > 0.15) {
          wordsSessionCache.set(trackId, { negative: true, time: Date.now() });
          return;
        }

        let matched = 0;
        const neLines = data.lines;
        let neIdx = 0;
        const lineWordsMap = [];
        for (let i = 0; i < state.syncedLyrics.length; i++) {
          const pText = state.syncedLyrics[i].text;
          let bestSim = 0;
          let bestNe = -1;
          const startJ = Math.max(0, neIdx - 3);
          const endJ = Math.min(neLines.length, neIdx + 4);
          for (let j = startJ; j < endJ; j++) {
            const sim = stringNormalizedSimilarity(pText, neLines[j].text);
            if (sim > bestSim) {
              bestSim = sim;
              bestNe = j;
            }
          }
          if (bestNe !== -1 && bestSim >= 0.6) {
            matched++;
            neIdx = bestNe + 1;
            lineWordsMap[i] = neLines[bestNe].words;
          }
        }

        if (matched / state.syncedLyrics.length < 0.70) {
          wordsSessionCache.set(trackId, { negative: true, time: Date.now() });
          return;
        }

        for (let i = 0; i < state.syncedLyrics.length; i++) {
          if (lineWordsMap[i]) {
            state.syncedLyrics[i].words = lineWordsMap[i];
          }
        }
      } else {
        state.syncedLyrics = data.lines.map(l => ({ time: l.start, text: l.text, words: l.words }));
        renderLyricsView();
        setLyricsEmpty(false);
        if (typeof syncTvLayout === 'function') syncTvLayout(false);
        if (typeof updateTvkLyricsStatus === 'function') updateTvkLyricsStatus();
        wordsSessionCache.set(trackId, { wordsByLine: state.syncedLyrics.map(l => l.words), time: Date.now() });
        return;
      }

      upgradeLyricsWordsInPlace();
      wordsSessionCache.set(trackId, { wordsByLine: state.syncedLyrics.map(l => l.words), time: Date.now() });
    } catch (_) {
      wordsSessionCache.set(trackId, { negative: true, time: Date.now() });
    }
  }

  function tagWrappedLyricRows(container) {
    if (!container || !container.clientHeight) return;
    const lines = container.querySelectorAll('.lyric-line');
    const updates = [];
    for (let i = 0; i < lines.length; i++) {
      const words = lines[i].querySelectorAll('.lyric-word');
      if (words.length > 1) {
        let rowIdx = 0;
        let lastTop = words[0].offsetTop;
        for (let j = 0; j < words.length; j++) {
          const w = words[j];
          const top = w.offsetTop;
          if (top > lastTop + 4) {
            rowIdx++;
            lastTop = top;
          }
          const subline = String(Math.min(rowIdx, 3));
          if (w._lastSubline !== subline) {
            updates.push({ el: w, subline });
          }
        }
      }
    }
    for (let i = 0; i < updates.length; i++) {
      const u = updates[i];
      u.el._lastSubline = u.subline;
      u.el.style.setProperty('--subline', u.subline);
    }
  }

  function cleanLyricParenWord(text) {
    if (!text) return '';
    return String(text).replace(/[()[\]]/g, '');
  }

  function splitLyricParensToEnd(rawText) {
    const str = String(rawText || '').replace(/<[^>]+>/g, '').trim();
    if (!str) return { mainText: '', parenText: '', startRatio: 0.7, endRatio: 1.0 };
    const totalLen = Math.max(1, str.length);
    const parens = [];
    let firstStart = -1;
    let lastEnd = -1;
    const mainText = str.replace(/(?:\(([^)]+)\)|\[([^\]]+)\])/g, (match, p1, p2, offset) => {
      const cleanInner = (p1 || p2 || '').trim();
      if (cleanInner) {
        parens.push(cleanLyricParenWord(cleanInner));
        if (firstStart === -1) firstStart = offset;
        lastEnd = offset + match.length;
      }
      return ' ';
    }).replace(/\s{2,}/g, ' ').trim();
    if (!mainText) {
      return { mainText: cleanLyricParenWord(str), parenText: '', startRatio: 0.7, endRatio: 1.0 };
    }
    const startRatio = firstStart >= 0 ? Math.max(0.05, Math.min(0.85, firstStart / totalLen)) : 0.7;
    const endRatio = lastEnd > firstStart ? Math.max(startRatio + 0.12, Math.min(1.0, lastEnd / totalLen)) : 1.0;
    return {
      mainText,
      parenText: parens.length > 0 ? parens.join(' ') : '',
      startRatio,
      endRatio
    };
  }

  function upgradeLyricsWordsInPlace() {
    state.syncedLyrics.forEach((line, index) => {
      if (line.words && Array.isArray(line.words) && line.words.length > 0 && !line.isGap) {
        const buildWordNodes = () => {
          const fragment = document.createDocumentFragment();
          let inParen = false;
          line.words.forEach((wObj, wIdx) => {
            const wText = typeof wObj === 'string' ? wObj : (wObj ? (wObj.word || wObj.text || '') : '');
            if (!wText) return;
            if (/[(\[]/.test(wText)) inParen = true;
            const isP = inParen;
            const wSpan = document.createElement('span');
            wSpan.className = 'lyric-word' + (isP ? ' lyric-paren' : '');
            wSpan.dataset.wordIdx = String(wIdx);
            wSpan.textContent = isP ? cleanLyricParenWord(wText) : wText;
            fragment.appendChild(wSpan);
            if (wIdx < line.words.length - 1) {
              fragment.appendChild(document.createTextNode(' '));
            }
            if (/[)\]]/.test(wText)) inParen = false;
          });
          return fragment;
        };

        const mainDiv = document.getElementById(`lyric-line-${index}`);
        if (mainDiv && !isGradientMode() && getAdv('karaoke_words', true) && state.lyricsMode === 'word') {
          const trEl = mainDiv.querySelector('.lyric-translation');
          mainDiv.innerHTML = '';
          mainDiv.appendChild(buildWordNodes());
          if (trEl) {
            mainDiv.appendChild(trEl);
          }
        }
        const miniDiv = document.getElementById(`mini-lyric-line-${index}`);
        if (miniDiv) {
          miniDiv.innerHTML = '';
          miniDiv.appendChild(buildWordNodes());
        }
      }
    });
    if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
    tagWrappedLyricRows(el.lyricsContainer);
  }

  function showLyricsWarnToast(msg) {
    const warnEl = document.getElementById('lyrics-warn-badge');
    const panel = document.getElementById('right-panel') || (el && el.rightPanel);
    if (!warnEl) return;
    if (panel && warnEl.parentElement !== panel) {
      panel.appendChild(warnEl);
    }
    if (localStorage.getItem('riff_show_lyrics_warnings') === '0' || !warnEl || !msg) {
      warnEl.classList.add('hidden');
      warnEl.classList.remove('warn-animate');
      return;
    }
    warnEl.textContent = msg;
    warnEl.classList.remove('hidden', 'warn-animate');
    void warnEl.offsetWidth;
    warnEl.classList.add('warn-animate');
  }
  function normalizeLyricMetaClient(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/\s*-\s*topic$/i, '')
      .replace(/\s*[\(\[][^)\]]*(?:official\s*(?:music\s*)?(?:audio|video)|lyric\s*video|lyrics?|visualizer|hd|hq|4k)[^)\]]*[\)\]]/gi, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isStrictLyricMatchClient(reqTitle, reqArtist, candTitle, candArtist) {
    const t1 = normalizeLyricMetaClient(reqTitle);
    const t2 = normalizeLyricMetaClient(candTitle);
    if (!t1 || !t2 || t1 !== t2) return false;
    const a1 = normalizeLyricMetaClient(reqArtist);
    const a2 = normalizeLyricMetaClient(candArtist);
    if (!a1 || !a2) return false;
    return a1 === a2;
  }

  function isInstrumentalOrBreakcoreTrack(title, artist) {
    return /\b(?:instrumental|breakcore|type\s+beat|backing\s+track|minus\s+one|minusovka|минусовка|karaoke\s+version|karaoke\s+mix)\b/i.test(`${title || ''} ${artist || ''}`);
  }

  async function fallbackDirectLyricsSearch(title, artist) {
    if (!title || !artist || isInstrumentalOrBreakcoreTrack(title, artist)) return null;
    const qTitle = normalizeLyricMetaClient(title);
    const qArtist = normalizeLyricMetaClient(artist);
    if (!qTitle || !qArtist) return null;

    try {
      const lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title.trim())}&artist_name=${encodeURIComponent(artist.trim())}`;
      const lrcRes = await fetch(lrcUrl, { signal: AbortSignal.timeout(4000) });
      if (lrcRes.ok) {
        const lrcJson = await lrcRes.json();
        if (lrcJson?.instrumental) return null;
        if (isStrictLyricMatchClient(title, artist, lrcJson?.trackName || lrcJson?.title || lrcJson?.name, lrcJson?.artistName || lrcJson?.artist)) {
          const txt = lrcJson?.syncedLyrics || lrcJson?.plainLyrics;
          if (txt && txt.trim()) return { success: true, lyrics: txt };
        }
      }
    } catch (_) {}

    try {
      const sUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(artist.trim() + ' ' + title.trim())}`;
      const sRes = await fetch(sUrl, { signal: AbortSignal.timeout(4000) });
      if (sRes.ok) {
        const sJson = await sRes.json();
        if (Array.isArray(sJson) && sJson.length) {
          const matched = sJson.filter(i =>
            i && !i.instrumental &&
            isStrictLyricMatchClient(title, artist, i.trackName || i.title || i.name, i.artistName || i.artist)
          );
          const best = matched.find(i => i.syncedLyrics) || matched[0];
          const txt = best?.syncedLyrics || best?.plainLyrics;
          if (txt && txt.trim()) return { success: true, lyrics: txt };
        }
      }
    } catch (_) {}

    return null;
  }

  async function loadSyncedLyrics(title, artist, token) {
    showLyricsWarnToast(null);
    state.isLoadingLyrics = true;
    state.lyricsLoaded = false;
    if (typeof updateTvkLyricsStatus === 'function') updateTvkLyricsStatus();
    if (el.lyricsContainer) {
      el.lyricsContainer.scrollTop = 0;
      el.lyricsContainer.style.transition = 'opacity 200ms cubic-bezier(0.2, 0, 0, 1)';
      el.lyricsContainer.style.opacity = '0';
    }
    if (typeof lyricsScrollRaf !== 'undefined' && lyricsScrollRaf) {
      cancelAnimationFrame(lyricsScrollRaf);
      lyricsScrollRaf = 0;
    }
    if (typeof resetManualLyricsWheel === 'function') resetManualLyricsWheel();
    state.lastActiveLyricIdx = -1;
    state.forceLyricsScroll = true;
    state.forceSnapLyrics = true;
    state.syncedLyrics = [];
    state.isCustomLyrics = false;
    if (typeof renderMiniLyrics === 'function') renderMiniLyrics();

    try {
      const source = localStorage.getItem('riff_lyrics_source') || 'auto';
      const trackId = (state.currentTrack && state.currentTrack.id) || `${artist}:${title}`;
      const lyricsCacheKey = `${trackId}:${source}`;

      if (!lyricsSessionCache.has(lyricsCacheKey)) {
        setRightPanelLyricsEmptySmooth(true);
      }

      let data = lyricsSessionCache.get(lyricsCacheKey);
      if (!data) {
        const port = state.serverPort || 38472;
        const onlineParam = !getAdv('online_lyrics', true) ? '0' : '1';
        const durationParam = (state.currentTrack && state.currentTrack.duration) ? `&duration=${encodeURIComponent(state.currentTrack.duration)}` : '';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&online=${onlineParam}&source=${encodeURIComponent(source)}${durationParam}`, { signal: controller.signal });
          data = await res.json();
          if (data && data.success && data.lyrics) {
            lyricsSessionCache.set(lyricsCacheKey, data);
          } else if (data && data.isCustom) {
            lyricsSessionCache.set(lyricsCacheKey, data);
          }
        } catch (fetchErr) {
          data = null;
        } finally {
          clearTimeout(timeoutId);
        }


        
        if ((!data || !data.success || !data.lyrics) && (!data || !data.isCustom) && onlineParam === '1') {
          const fb = await fallbackDirectLyricsSearch(title, artist);
          if (fb && fb.success && fb.lyrics) {
            data = fb;
            lyricsSessionCache.set(lyricsCacheKey, data);
          }
        }
      }

      if (token !== state.loadToken || (state.currentTrack && (state.currentTrack.title || '') !== title)) return;

      if (data && data.isCustom && (!data.lyrics || !data.lyrics.trim())) {
        state.syncedLyrics = [];
        state.isLoadingLyrics = false;
        state.lyricsLoaded = true;
        if (el.lyricsStatus) el.lyricsStatus.textContent = 'Custom';
        if (el.lyricsContainer) {
          el.lyricsContainer.innerHTML = '';
          el.lyricsContainer.scrollTop = 0;
          el.lyricsContainer.style.opacity = '1';
        }
        setRightPanelLyricsEmptySmooth(true);
        if (typeof syncTvLayout === 'function') syncTvLayout(true);
        updateTvKaraokeMeta();
        if (typeof updateTvkLyricsStatus === 'function') updateTvkLyricsStatus();
        return;
      }

      if (data && (data.isExplicit || (typeof isLyricsExplicit === 'function' && isLyricsExplicit(data.lyrics))) && state.currentTrack) {
        state.currentTrack.isExplicit = true;
        const canId = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(state.currentTrack) : '') || state.currentTrack.id;
        if (canId && explicitTrackCache) explicitTrackCache.add(canId);
        updateNowPlayingUI(state.currentTrack);
        const activeRowArtistWrap = document.querySelector('.track-row.playing .track-row-artist-wrap');
        if (activeRowArtistWrap && !activeRowArtistWrap.querySelector('.explicit-badge')) {
          const b = document.createElement('span');
          b.className = 'explicit-badge';
          b.title = 'Explicit';
          b.textContent = 'E';
          activeRowArtistWrap.prepend(b);
        }
      }

      if (!data || !data.success || !data.lyrics) {
        state.syncedLyrics = [];
        state.isLoadingLyrics = false;
        state.lyricsLoaded = true;
        if (el.lyricsStatus) el.lyricsStatus.textContent = '';
        if (el.lyricsContainer) {
          el.lyricsContainer.innerHTML = '';
          el.lyricsContainer.scrollTop = 0;
          el.lyricsContainer.style.opacity = '1';
        }
        showLyricsWarnToast(typeof t === 'function' ? t('No lyrics found') : 'No lyrics found');
        setRightPanelLyricsEmptySmooth(true);
        if (typeof syncTvLayout === 'function') syncTvLayout(true);
        if (typeof updateTvkLyricsStatus === 'function') updateTvkLyricsStatus();
        return;
      }

      state.isCustomLyrics = !!data.isCustom;

      const raw = data.lyrics;
      const lines = raw.split('\n');
      let parsed = [];
      const lrcRegex = /\[(\d+):(\d+(\.\d+)?)\](.*)/;
      const headerRegex = /\[(?!(?:\d+:\d+|instrumental|music|intro|outro|solo)\b)[^\]]*\]/gi;

      const gapPattern1 = /^[\s♪♫\-–—.]*$/;
      const gapPattern2 = /^[\(\[]?\s*(?:instrumental|music|intro|outro|solo|interlude|break)\s*[\)\]]?$/i;

      const isGarbageHeaderLine = (txt) => {
        const s = String(txt || '').trim();
        if (/^\d*\s*Contributors/i.test(s)) return true;
        if (/^(?:\[[^\]]*\]\s*)?.*?(?:Lyrics|Текст песни)\s*$/i.test(s)) return true;
        if (/^You might also like$/i.test(s)) return true;
        if (/^\d*\s*Embed$/i.test(s)) return true;
        return false;
      };

      for (const line of lines) {
        const match = lrcRegex.exec(line);
        if (match) {
          const min = parseInt(match[1], 10);
          const sec = parseFloat(match[2]);
          const rawText = match[4].replace(headerRegex, '').trim();
          const lineTime = min * 60 + sec;
          if (!rawText || gapPattern1.test(rawText) || gapPattern2.test(rawText)) {
            parsed.push({ time: lineTime, text: '', isGap: true });
            continue;
          }
          const cleanText = rawText.replace(/<[^>]+>/g, '').trim();
          if (isGarbageHeaderLine(cleanText)) continue;
          const enhWords = parseEnhancedLrcWords(rawText, lineTime, lineTime + 4.0);
          parsed.push({ time: lineTime, text: cleanText, words: enhWords || undefined });
        } else {
          const cleanPlain = line.replace(headerRegex, '').trim();
          if (cleanPlain) {
            if (gapPattern1.test(cleanPlain) || gapPattern2.test(cleanPlain)) {
              parsed.push({ time: -1, text: '', isGap: true });
            } else if (!isGarbageHeaderLine(cleanPlain)) {
              parsed.push({ time: -1, text: cleanPlain });
            }
          }
        }
      }

      while (parsed.length > 0 && isGarbageHeaderLine(parsed[0].text)) {
        parsed.shift();
      }
      while (parsed.length > 0 && /^\d*\s*Embed$/i.test(String(parsed[parsed.length - 1].text || '').trim())) {
        parsed.pop();
      }

      if (parsed.length >= 8) {
        const half = Math.floor(parsed.length / 2);
        const fText = parsed.slice(0, half).map(p => p.text).join('\n').trim();
        const sText = parsed.slice(half).map(p => p.text).join('\n').trim();
        if (fText && fText === sText) {
          parsed = parsed.slice(0, half);
        }
      }

      if (parsed.length === 0) {
        state.syncedLyrics = [];
        state.isLoadingLyrics = false;
        state.lyricsLoaded = true;
        if (el.lyricsStatus) el.lyricsStatus.textContent = '';
        if (el.lyricsContainer) {
          el.lyricsContainer.innerHTML = '';
          el.lyricsContainer.scrollTop = 0;
          el.lyricsContainer.style.opacity = '1';
        }
        showLyricsWarnToast(typeof t === 'function' ? t('No lyrics found') : 'No lyrics found');
        setRightPanelLyricsEmptySmooth(true);
        if (typeof syncTvLayout === 'function') syncTvLayout(true);
        if (typeof updateTvkLyricsStatus === 'function') updateTvkLyricsStatus();
        return;
      }

      const hasSyncTimes = parsed.some(p => p.time >= 0);
      if (hasSyncTimes) {
        showLyricsWarnToast(null);
      } else {
        showLyricsWarnToast(typeof t === 'function' ? t('No sync found') : 'No sync found');
      }
      if (hasSyncTimes) {
        for (let i = 0; i < parsed.length; i++) {
          const t = String(parsed[i].text || '').trim();
          if (!t || gapPattern1.test(t) || gapPattern2.test(t)) {
            parsed[i] = { ...parsed[i], text: '', isGap: true };
          }
        }
        if (parsed.length > 0 && parsed[0].time >= 6) {
          parsed.unshift({ time: 0, text: '', isGap: true });
        }
        const withGaps = [];
        for (let i = 0; i < parsed.length; i++) {
          withGaps.push(parsed[i]);
          if (i < parsed.length - 1 && parsed[i].time >= 0 && parsed[i + 1].time >= 0 && !parsed[i].isGap && !parsed[i + 1].isGap) {
            const line = parsed[i];
            const estEnd = (line.words && line.words.length && (line.words[line.words.length - 1].end || line.words[line.words.length - 1].endTime))
              ? (line.words[line.words.length - 1].end || line.words[line.words.length - 1].endTime)
              : (line.time + 4.0);
            if (parsed[i + 1].time - estEnd >= 6) {
              withGaps.push({ time: estEnd, text: '', isGap: true });
            }
          }
        }
        parsed = withGaps;
      }

      state.syncedLyrics = parsed;
      state.isLoadingLyrics = false;
      state.lyricsLoaded = true;
      if (typeof updateTvkLyricsStatus === 'function') updateTvkLyricsStatus();
      if (el.lyricsStatus) el.lyricsStatus.textContent = data.isCustom ? (hasSyncTimes ? 'Custom synced' : 'Custom') : (hasSyncTimes ? 'Synced' : 'Plain');
      if (state.trEnabled && state.trAuto) {
        state.trActive = true;
        fetchAndApplyTranslation();
      } else {
        state.trActive = false;
        state.currentTranslations = null;
      }
      updateLyricsTranslationUI();
      renderLyricsView();
      if (!isLyricsFullscreenOnly()) {
        setRightPanelLyricsEmptySmooth(false);
        const rpCreditsCard = document.getElementById('rp-credits-card');
        if (rpCreditsCard) {
          rpCreditsCard.classList.add('hidden');
          rpCreditsCard.innerHTML = '';
        }
        if (el.rightPanel) el.rightPanel.classList.remove('has-credits');
        const rpPanel = el.rightPanel || document.getElementById('right-panel');
        if (rpPanel) rpPanel.classList.remove('has-credits');
      } else {
        if (state.currentTrack) updateRightPanelCredits(state.currentTrack);
      }
      if (typeof syncTvLayout === 'function') syncTvLayout(false);
      if (state.isTvKaraokeOpen) {
        if (el.tvKaraokeContent && el.lyricsContainer && el.lyricsContainer.parentNode !== el.tvKaraokeContent) {
          el.tvKaraokeContent.appendChild(el.lyricsContainer);
        }
        updateLyricsPadding();
        state.forceSnapLyrics = true;
        state.forceLyricsScroll = true;
        state.lastActiveLyricIdx = -1;
        if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
      }
      if (el.lyricsContainer) {
        el.lyricsContainer.scrollTop = 0;
        el.lyricsContainer.style.opacity = '1';
      }
      state.lastActiveLyricIdx = -1;
      state.forceLyricsScroll = true;
      state.forceSnapLyrics = true;
      if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);

      const isLocalTrack = Boolean(state.currentTrack && (state.currentTrack.platform === 'local' || state.currentTrack.source === 'local' || String(state.currentTrack.id || '').startsWith('local_')));
      if (!isLocalTrack) {
        fetchAndUpgradeWords(title, artist, trackId, token);
      }
    } catch (e) {
      if (token === state.loadToken) {
        state.syncedLyrics = [];
        state.isLoadingLyrics = false;
        state.lyricsLoaded = true;
        if (el.lyricsStatus) el.lyricsStatus.textContent = '';
        if (el.lyricsContainer) {
          el.lyricsContainer.innerHTML = '';
          el.lyricsContainer.style.opacity = '1';
        }
        updateLyricsBadge('no-lyrics');
        setRightPanelLyricsEmptySmooth(true);
        if (typeof syncTvLayout === 'function') syncTvLayout(true);
        if (typeof updateTvkLyricsStatus === 'function') updateTvkLyricsStatus();
      }
    }
  }

  function getLyricsWordStyle() { return localStorage.getItem('riff_lyrics_word_style') === 'words' ? 'words' : 'gradient'; }
  function isGradientMode() { return state.lyricsMode === 'word' && getAdv('karaoke_words', true) && getLyricsWordStyle() === 'gradient'; }

  var LYRIC_STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'nor', 'if', 'then', 'else', 'when', 'at', 'by', 'for', 'with', 'about', 'against',
    'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
    'on', 'off', 'over', 'under', 'again', 'further', 'once', 'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just',
    'should', 'now', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
    'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
    'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'would', 'could', 'im', 'ive', 'dont',
    'cant', 'wont', 'youre', 'theyre', 'weve', 'hes', 'shes', 'yeah', 'oh', 'ooh', 'ah', 'la', 'na', 'uh', 'baby',
    'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все', 'она', 'так', 'его', 'но', 'да', 'ты',
    'к', 'ко', 'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'ее', 'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о',
    'об', 'про', 'из', 'ему', 'теперь', 'когда', 'даже', 'ну', 'вдруг', 'ли', 'если', 'уже', 'или', 'ни', 'быть', 'был',
    'него', 'до', 'вас', 'нибудь', 'опять', 'уж', 'вам', 'ведь', 'там', 'потом', 'себя', 'ничего', 'ей', 'может', 'они',
    'тут', 'где', 'есть', 'надо', 'ней', 'для', 'мы', 'тебя', 'их', 'чем', 'была', 'сам', 'чтоб', 'без', 'будто', 'чего',
    'раз', 'тоже', 'себе', 'под', 'будет', 'ж', 'тогда', 'кто', 'этот', 'того', 'потому', 'этого', 'какой', 'совсем', 'ним',
    'здесь', 'этом', 'один', 'почти', 'мой', 'тем', 'чтобы', 'нее', 'сейчас', 'были', 'куда', 'зачем', 'всех', 'никогда',
    'можно', 'при', 'наконец', 'два', 'другой', 'хоть', 'после', 'над', 'больше', 'тот', 'через', 'эти', 'нас', 'всего',
    'них', 'какая', 'много', 'разве', 'три', 'эту', 'моя', 'впрочем', 'хорошо', 'свою', 'этой', 'перед', 'иногда', 'лучше',
    'чуть', 'том', 'нельзя', 'такой', 'им', 'более', 'всегда', 'конечно', 'всю', 'между', 'ага', 'угу', 'эх', 'ай', 'ой'
  ]);

  function computeLyricsKeywords() {
    if (!state.syncedLyrics || !state.syncedLyrics.length) return;
    const totalDuration = state.duration || (el.nativeAudio ? el.nativeAudio.duration : 0) || 180;
    let peaks = null;
    if (state.currentTrack && typeof computeFastWaveformPeaks === 'function') {
      peaks = computeFastWaveformPeaks(state.currentTrack, 120);
    }

    function getLoudnessAt(t) {
      if (peaks && peaks.length > 0 && totalDuration > 0) {
        const norm = Math.max(0, Math.min(0.999, t / totalDuration));
        const pIdx = Math.floor(norm * peaks.length);
        return peaks[pIdx] || 0.5;
      }
      return 0.5;
    }

    let lastKwLine = -999;

    for (let idx = 0; idx < state.syncedLyrics.length; idx++) {
      const line = state.syncedLyrics[idx];
      if (!line) continue;
      line.keyword = null;
      if (line.isGap || line.time < 0) continue;

      if (idx - lastKwLine < 3) continue;

      const lineStart = getLineStartTime(idx);
      const lineDur = getEffectiveLineDuration(idx);

      let wordsData = [];
      if (line.words && Array.isArray(line.words) && line.words.length > 0) {
        line.words.forEach((w, wIdx) => {
          const text = typeof w === 'string' ? w : (w ? (w.word || w.text || '') : '');
          const wStart = (w && (w.start !== undefined ? w.start : w.time)) ?? (lineStart + (wIdx / line.words.length) * lineDur);
          const wEnd = (w && (w.end !== undefined ? w.end : w.endTime)) ?? (wStart + lineDur / line.words.length);
          const dur = Math.max(0.05, wEnd - wStart);
          wordsData.push({ text, start: wStart, end: wEnd, dur, wordIdx: wIdx });
        });
      } else {
        const tokens = String(line.text || '').trim().split(/\s+/).filter(Boolean);
        if (tokens.length > 0) {
          let sumW = 0;
          const weights = tokens.map(tok => {
            const clean = tok.replace(/[\s\p{P}]/gu, '');
            let w = Math.max(1.4, clean.length * 0.55);
            if (/[.!?。！？…]+|\.{2,}/.test(tok)) w += 3.0;
            else if (/[,;:、，；]/.test(tok)) w += 1.8;
            sumW += w;
            return w;
          });
          let curT = lineStart;
          tokens.forEach((tok, wIdx) => {
            const dur = Math.max(0.1, (weights[wIdx] / sumW) * lineDur);
            const wStart = curT;
            const wEnd = curT + dur;
            curT = wEnd;
            wordsData.push({ text: tok, start: wStart, end: wEnd, dur, wordIdx: wIdx });
          });
        }
      }

      if (wordsData.length < 2) continue;

      const validWords = wordsData.filter(w => {
        const clean = w.text.replace(/[\s\p{P}]/gu, '');
        return clean.length >= 2;
      });
      if (!validWords.length) continue;

      const mu = validWords.reduce((acc, w) => acc + w.dur, 0) / validWords.length;

      let bestCandidate = null;
      let maxScore = -999;
      let bestFallback = null;
      let maxFallbackScore = -999;

      for (const w of validWords) {
        const clean = w.text.replace(/[\s\p{P}]/gu, '').toLowerCase();
        const isStop = LYRIC_STOP_WORDS.has(clean);
        const midT = (w.start + w.end) / 2;
        const loudness = getLoudnessAt(midT);
        const durRatio = mu > 0 ? (w.dur / mu) : 1;
        const lenScore = Math.min(1.2, clean.length / 6);
        const isEmphasis = /[!?.,;:…]+$/.test(w.text) ? 0.35 : 0;

        const fallbackScore = (durRatio * 0.4) + (lenScore * 0.35) + (loudness * 0.25) + isEmphasis - (isStop ? 0.6 : 0);
        if (fallbackScore > maxFallbackScore) {
          maxFallbackScore = fallbackScore;
          bestFallback = { ...w, score: fallbackScore };
        }

        if (!isStop && clean.length >= 3) {
          const score = (durRatio * 0.5) + (lenScore * 0.4) + (loudness * 0.25) + isEmphasis;
          if (score > maxScore) {
            maxScore = score;
            bestCandidate = { ...w, score };
          }
        }
      }

      const dist = idx - lastKwLine;
      let chosen = null;
      if (dist >= 3) {
        if (bestCandidate && maxScore >= 0.65) {
          chosen = bestCandidate;
        } else if (dist >= 5 && (bestCandidate || (bestFallback && maxFallbackScore >= 0.75))) {
          chosen = bestCandidate || bestFallback;
        }
      }

      if (chosen) {
        line.keyword = chosen;
        lastKwLine = idx;
      }
    }
  }

  function renderLyricsView() {
    window.renderLyricsView = renderLyricsView;
    cachedActiveGapEl = null;
    cachedLyricsValidLines = null;
    cachedLyricsRef = null;
    if (!el.lyricsContainer) return;
    if (state.syncedLyrics.length === 0) return;
    if (state.isTvKaraokeOpen) {
      if (el.tvKaraokeContent && el.lyricsContainer.parentNode !== el.tvKaraokeContent) {
        el.tvKaraokeContent.appendChild(el.lyricsContainer);
      }
      if (typeof syncTvLayout === 'function') syncTvLayout(false);
      if (typeof updateTvkLyricsStatus === 'function') updateTvkLyricsStatus();
    }
    if (el.lyricsContainer) el.lyricsContainer.style.opacity = '1';
    computeLyricsKeywords();
    el.lyricsContainer.innerHTML = '';

    state.syncedLyrics.forEach((line, index) => {
      const div = document.createElement('div');
      div.className = 'lyric-line';
      div.id = `lyric-line-${index}`;

      if (line.isGap) {
        div.classList.add('lyric-gap');
        div.innerHTML = `
          <div class="lyric-gap-wrap">
            <div class="lyric-gap-note-wrap">
              <svg class="lyric-gap-note-bg" width="28" height="28" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
              <div class="lyric-gap-note-fill">
                <svg width="28" height="28" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
            </div>
          </div>
        `;
      } else {
        const lineText = line.text || '';
        const isRtl = (typeof window.isRtlLanguageCode === 'function' && window.isRtlLanguageCode(state?.lyricsTranslationLang)) || (typeof RTL_CHAR_RE !== 'undefined' ? RTL_CHAR_RE.test(lineText) : (typeof isRtlText === 'function' && isRtlText(lineText)));
        if (isRtl) {
          div.setAttribute('dir', 'rtl');
          div.classList.add('rtl-line', 'rtl');
        }

        if (isGradientMode()) {
          const { mainText, parenText, startRatio, endRatio } = splitLyricParensToEnd(lineText);
          div.classList.add('gradient-line');
          const fillMain = document.createElement('span');
          fillMain.className = 'lyric-fill lyric-fill-main';

          if (line.keyword && line.keyword.text) {
            const kw = line.keyword;
            const cleanWord = kw.text.replace(/^[(\[]+|[)\].,!?]+$/g, '');
            const targetWord = cleanWord || kw.text;
            const escapedWord = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`(^|\\s|[\\p{P}])(${escapedWord})($|\\s|[\\p{P}])`, 'ui');
            const match = mainText.match(re);
            if (match) {
              const prefixLen = match.index + match[1].length;
              const matchedWord = match[2];
              const prefix = mainText.slice(0, prefixLen);
              const suffix = mainText.slice(prefixLen + matchedWord.length);
              const fullLen = (mainText + (parenText ? (' ' + parenText) : '')).length || 1;
              const rStart = prefixLen / fullLen;
              const rEnd = (prefixLen + matchedWord.length) / fullLen;

              fillMain.appendChild(document.createTextNode(prefix));
              const kwSpan = document.createElement('span');
              kwSpan.className = 'lyric-keyword';
              kwSpan.dataset.kwStart = String(kw.start.toFixed(3));
              kwSpan.dataset.kwEnd = String(kw.end.toFixed(3));
              kwSpan.dataset.kwStartRatio = String(rStart.toFixed(4));
              kwSpan.dataset.kwEndRatio = String(rEnd.toFixed(4));
              kwSpan.textContent = matchedWord;
              fillMain.appendChild(kwSpan);
              fillMain.appendChild(document.createTextNode(suffix));
            } else {
              fillMain.textContent = mainText;
            }
          } else {
            fillMain.textContent = mainText;
          }

          div.appendChild(fillMain);
          if (parenText) {
            const fillParen = document.createElement('span');
            fillParen.className = 'lyric-fill lyric-paren';
            fillParen.dataset.startRatio = String(startRatio.toFixed(3));
            fillParen.dataset.endRatio = String(endRatio.toFixed(3));
            fillParen.textContent = ' ' + parenText;
            div.appendChild(fillParen);
          }
        } else if (line.words && Array.isArray(line.words) && line.words.length > 0) {
          div.innerHTML = '';
          let inParen = false;
          line.words.forEach((wObj, wIdx) => {
            const wText = typeof wObj === 'string' ? wObj : (wObj ? (wObj.word || wObj.text || '') : '');
            if (!wText) return;
            if (/[(\[]/.test(wText)) inParen = true;
            const isP = inParen;
            const wSpan = document.createElement('span');
            const isKw = line.keyword && line.keyword.wordIdx === wIdx;
            wSpan.className = 'lyric-word' + (isP ? ' lyric-paren' : '') + (isKw ? ' lyric-keyword' : '');
            if (isKw) {
              wSpan.dataset.kwStart = String(line.keyword.start.toFixed(3));
              wSpan.dataset.kwEnd = String(line.keyword.end.toFixed(3));
            }
            wSpan.dataset.wordIdx = String(wIdx);
            wSpan.textContent = isP ? cleanLyricParenWord(wText) : wText;
            div.appendChild(wSpan);
            if (wIdx < line.words.length - 1) {
              div.appendChild(document.createTextNode(' '));
            }
            if (/[)\]]/.test(wText)) inParen = false;
          });
        } else {
          div.innerHTML = '';
          let inParen = false;
          const tokens = String(lineText).trim().split(/\s+/).filter(Boolean);
          tokens.forEach((tok, wIdx) => {
            if (/[(\[]/.test(tok)) inParen = true;
            const isP = inParen;
            const wSpan = document.createElement('span');
            const isKw = line.keyword && line.keyword.wordIdx === wIdx;
            wSpan.className = 'lyric-word' + (isP ? ' lyric-paren' : '') + (isKw ? ' lyric-keyword' : '');
            if (isKw) {
              wSpan.dataset.kwStart = String(line.keyword.start.toFixed(3));
              wSpan.dataset.kwEnd = String(line.keyword.end.toFixed(3));
            }
            wSpan.dataset.wordIdx = String(wIdx);
            wSpan.textContent = isP ? cleanLyricParenWord(tok) : tok;
            div.appendChild(wSpan);
            if (wIdx < tokens.length - 1) {
              div.appendChild(document.createTextNode(' '));
            }
            if (/[)\]]/.test(tok)) inParen = false;
          });
        }

        if (state.trActive && state.currentTranslations && state.currentTranslations[index]) {
          const trDiv = document.createElement('div');
          trDiv.className = 'lyric-translation';
          trDiv.dir = 'auto';
          trDiv.textContent = state.currentTranslations[index];
          div.appendChild(trDiv);
        }
      }

      if (line.time >= 0) {
        div.addEventListener('click', () => {
          const seekTime = getLineStartTime(index);
          if (el.nativeAudio && seekTime >= 0) el.nativeAudio.currentTime = seekTime;
          if (typeof updateSyncedLyricsHighlight === 'function') {
            updateSyncedLyricsHighlight(seekTime >= 0 ? seekTime : (el.nativeAudio?.currentTime || 0));
          }
        });
      }
      el.lyricsContainer.appendChild(div);
    });
    updateLyricsPadding();
    if (typeof resetManualLyricsWheel === 'function') resetManualLyricsWheel();
    state.lastActiveLyricIdx = -1;
    state.forceLyricsScroll = true;
    state.forceSnapLyrics = true;
    if (typeof layoutLyricsCascade === 'function') layoutLyricsCascade(-1, true);
    if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
    renderMiniLyrics();
    tagWrappedLyricRows(el.lyricsContainer);
    if (typeof updateTvkLyricsStatus === 'function') updateTvkLyricsStatus();
  }
  window.renderLyricsView = renderLyricsView;
  window.setSyncedLyricsForTesting = (lyrics) => {
    state.syncedLyrics = lyrics;
    renderLyricsView();
  };

  function renderMiniLyrics() {
    const container = document.getElementById('mini-lyrics-container');
    if (!container) return;
    if (!state.syncedLyrics || state.syncedLyrics.length === 0) {
      container.innerHTML = '<div class="mini-lyrics-empty">No lyrics</div>';
      return;
    }
    container.innerHTML = '';
    state.syncedLyrics.forEach((line, index) => {
      const div = document.createElement('div');
      div.className = 'mini-lyric-line';
      div.id = `mini-lyric-line-${index}`;
      div.setAttribute('dir', 'auto');
      if (line.isGap) {
        div.classList.add('lyric-gap');
        div.innerHTML = '<span class="lyric-gap-box"><i></i><i></i><i></i></span>';
      } else if (line.words && Array.isArray(line.words) && line.words.length > 0) {
        div.innerHTML = '';
        let inParen = false;
        line.words.forEach((wObj, wIdx) => {
          const wText = typeof wObj === 'string' ? wObj : (wObj ? (wObj.word || wObj.text || '') : '');
          if (!wText) return;
          if (/[(\[]/.test(wText)) inParen = true;
          const isP = inParen;
          const wSpan = document.createElement('span');
          wSpan.className = 'lyric-word' + (isP ? ' lyric-paren' : '');
          wSpan.dataset.wordIdx = String(wIdx);
          wSpan.textContent = isP ? cleanLyricParenWord(wText) : wText;
          div.appendChild(wSpan);
          if (wIdx < line.words.length - 1) {
            div.appendChild(document.createTextNode(' '));
          }
          if (/[)\]]/.test(wText)) inParen = false;
        });
      } else {
        div.innerHTML = '';
        let inParen = false;
        const tokens = String(line.text || '').trim().split(/\s+/).filter(Boolean);
        tokens.forEach((tok, wIdx) => {
          if (/[(\[]/.test(tok)) inParen = true;
          const isP = inParen;
          const wSpan = document.createElement('span');
          wSpan.className = 'lyric-word' + (isP ? ' lyric-paren' : '');
          wSpan.dataset.wordIdx = String(wIdx);
          wSpan.textContent = isP ? cleanLyricParenWord(tok) : tok;
          div.appendChild(wSpan);
          if (wIdx < tokens.length - 1) {
            div.appendChild(document.createTextNode(' '));
          }
          if (/[)\]]/.test(tok)) inParen = false;
        });
      }
      if (line.time >= 0) {
        div.addEventListener('click', () => {
          const seekTime = getLineStartTime(index);
          if (el.nativeAudio && seekTime >= 0) el.nativeAudio.currentTime = seekTime;
        });
      }
      container.appendChild(div);
    });
  }

  function getCachedValidLines() {
    if (cachedLyricsValidLines && cachedLyricsRef === state.syncedLyrics) {
      return cachedLyricsValidLines;
    }
    cachedLyricsRef = state.syncedLyrics;
    const lines = state.syncedLyrics;
    const result = [];
    if (Array.isArray(lines)) {
      for (let i = 0; i < lines.length; i++) {
        const startTime = getLineStartTime(i);
        if (startTime >= 0) result.push({ time: startTime, index: i });
      }
    }
    cachedLyricsValidLines = result;
    return result;
  }

  function findActiveLineIndex(validLines, matchTime) {
    const len = validLines ? validLines.length : 0;
    if (len === 0) return -1;
    if (matchTime < validLines[0].time) return -1;
    if (matchTime >= validLines[len - 1].time) return validLines[len - 1].index;
    let low = 0, high = len - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const cur = validLines[mid];
      const nextTime = mid + 1 < len ? validLines[mid + 1].time : Infinity;
      if (matchTime < cur.time) {
        high = mid - 1;
      } else if (matchTime >= nextTime) {
        low = mid + 1;
      } else {
        return cur.index;
      }
    }
    return -1;
  }

  function updateMiniLyricsHighlight(currentTime) {
    if (state.isTvKaraokeOpen) return;
    if (!document.body.classList.contains('mini') || !document.body.classList.contains('mini-lyrics-on')) return;
    if (!state.syncedLyrics || state.syncedLyrics.length === 0 || !state.isWindowVisible) return;
    const container = document.getElementById('mini-lyrics-container');
    if (!container || container.offsetParent === null) return;

    const validLines = getCachedValidLines();
    const lookAhead = state.isCustomLyrics ? 0.25 : 0.0;
    const matchTime = currentTime + lookAhead;
    const activeIndex = findActiveLineIndex(validLines, matchTime);

    const prevActive = container.querySelector('.mini-lyric-line.active');
    const prevIndex = prevActive ? parseInt(prevActive.id.replace('mini-lyric-line-', ''), 10) : -1;
    if (activeIndex !== prevIndex) {
      if (prevActive) {
        prevActive.classList.remove('active');
        prevActive.querySelectorAll('.lyric-word').forEach((w) => {
          const isP = w.classList.contains('lyric-paren') ? ' lyric-paren' : '';
          w.className = (prevIndex < activeIndex ? 'lyric-word past-word' : 'lyric-word') + isP;
        });
      }
      if (activeIndex >= 0) {
        const activeEl = document.getElementById(`mini-lyric-line-${activeIndex}`);
        if (activeEl) {
          activeEl.classList.add('active');
          const targetY = activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
          container.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        }
      }
    }

    if (activeIndex >= 0) {
      const activeEl = document.getElementById(`mini-lyric-line-${activeIndex}`);
      if (activeEl) {
        const line = state.syncedLyrics[activeIndex];
        if (line && line.words && Array.isArray(line.words) && line.words.length > 0) {
          const wordSpans = activeEl.querySelectorAll('.lyric-word');
          wordSpans.forEach((wSpan, wIdx) => {
            const w = line.words[wIdx];
            const wStart = w ? (w.time !== undefined ? w.time : (w.start || 0)) : (line.words[line.words.length - 1] ? (line.words[line.words.length - 1].endTime || line.words[line.words.length - 1].end || getLineEndTime(activeIndex)) : 0);
            const wEnd = w ? (w.endTime !== undefined ? w.endTime : (w.end || (line.words[wIdx + 1] ? (line.words[wIdx + 1].time || line.words[wIdx + 1].start) : getLineEndTime(activeIndex)))) : getLineEndTime(activeIndex);
            const isP = wSpan.classList.contains('lyric-paren') ? ' lyric-paren' : '';
            if (currentTime >= wEnd) {
              wSpan.className = 'lyric-word past-word' + isP;
            } else if (currentTime >= wStart) {
              wSpan.className = 'lyric-word active-word' + isP;
            } else {
              wSpan.className = 'lyric-word' + isP;
            }
          });
        } else if (getAdv('karaoke_words', true) && state.lyricsMode === 'word') {
          const currentLineTime = getLineStartTime(activeIndex);
          const nextLineTime = getLineEndTime(activeIndex);
          const lineDur = Math.max(0.5, nextLineTime - currentLineTime);
          const progress = Math.min(Math.max((matchTime - currentLineTime) / lineDur, 0), 0.999);
          const wordSpans = activeEl.querySelectorAll('.lyric-word');
          const currentWordIndex = computeEstimatedWordIndex(wordSpans, matchTime, activeIndex);
          wordSpans.forEach((wSpan, wIdx) => {
            const isP = wSpan.classList.contains('lyric-paren') ? ' lyric-paren' : '';
            if (wIdx < currentWordIndex) {
              wSpan.className = 'lyric-word past-word' + isP;
            } else if (wIdx === currentWordIndex) {
              wSpan.className = 'lyric-word active-word' + isP;
            } else {
              wSpan.className = 'lyric-word' + isP;
            }
          });
        }
      }
    }
  }

  function updateLyricsPadding() {
    const c = el.lyricsContainer;
    if (!c) return;
    c.style.paddingTop = '0px';
    c.style.paddingBottom = '0px';
    tagWrappedLyricRows(c);
    if (typeof layoutLyricsCascade === 'function') layoutLyricsCascade(state.lastActiveLyricIdx, true);
  }
  window.addEventListener('resize', () => {
    state.forceLyricsScroll = true;
    state.forceSnapLyrics = true;
    updateLyricsPadding();
    if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
  });
  if (window.ResizeObserver && el.lyricsContainer) {
    let lastObservedH = 0;
    let lastObservedW = 0;
    new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      const h = Math.round(rect?.height || el.lyricsContainer.clientHeight || 0);
      const w = Math.round(rect?.width || el.lyricsContainer.clientWidth || 0);
      if (h <= 0 && w <= 0) {
        lastObservedH = 0;
        lastObservedW = 0;
        return;
      }
      if (Math.abs(h - lastObservedH) > 4 || Math.abs(w - lastObservedW) > 4) {
        lastObservedH = h;
        lastObservedW = w;
        updateLyricsPadding();
        if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
      }
    }).observe(el.lyricsContainer);
  }

  var AUTO_I18N_SELECTORS = [
    '[data-i18n]',
    '.setting-name',
    '.setting-hint',
    '.setting-item-top div > span:not(.setting-name):not(.riff-beta-badge)',
    '.setting-item > div:not([class]):not(:has(*))',
    '.setting-hints > span',
    '.customizer-box > div:first-child',
    '.settings-section-title',
    '.rail-drawer-title',
    '.home-pane-label',
    '.dialog-header h3',
    '.modal-title',
    '.btn-pill-primary > span',
    '.btn-outline-pill > span',
    '.custom-lyrics-tip > span',
    '.empty-hint',
    'button.btn-pill-primary:not(:has(*))',
    'button.btn-outline-pill:not(:has(*))',
    'button.btn-text:not(:has(*))',
    'button.btn-text-error:not(:has(*))',
    'button.theme-mode-btn:not(:has(*))',
    '.settings-nav-btn > span',
    '.sb-horiz-tab',
    '.np-queue-tab',
    '.search-chip',
    '.audio-tab > span:not([class])',
    '.artist-horiz-tab > span:not([class])',
    '.sleep-timer-hint',
    '.hq-label',
    '.cpm-import-label',
    '.download-section-label',
    '.tvk-label',
    '.tvk-pill-btn'
  ].join(', ');

  var DYNAMIC_EXCLUDE_SEL = [
    '#ui-lang-dropdown', '#tr-lang-dropdown', '#langMenu',
    '#right-panel-title', '#right-panel-artist', '.right-panel-meta',
    '#playbar-title', '#playbar-artist', '.playbar-left .track-meta',
    '#tv-karaoke-title', '#tv-karaoke-artist', '.tv-karaoke-meta',
    '#playlist-detail-title', '#playlist-detail-desc', '#playlist-detail-count',
    '#album-detail-title', '#album-detail-artist', '#album-detail-count',
    '#artist-profile-name', '#artist-profile-bio', '#artist-fans-line', '#artist-tracks-count',
    '#my-wave-focused-title', '#my-wave-focused-artist', '#jump-focused-title', '#jump-focused-artist',
    '#favorites-subtitle', '#local-subtitle', '.setting-value', '.time-label',
    '.track-row', '.sp-card', '.sb-lib-row', '.np-queue-row', '#lyrics-container',
    '.riff-hero-title', '.settings-version-tag', '#about-version'
  ].join(', ');

  var PROTECTED_BRAND_TEXTS = new Set([
    'riff', 'youtube', 'youtube music', 'soundcloud', 'spotify', 'apple music',
    'deezer', 'yandex music', 'discord rpc', 'last.fm', 'lrclib', 'musixmatch',
    'kugou lrc', 'netease', 'genius', 'google sans', 'sf pro', 'lucide crisp',
    'solar duotone', 'yt-dlp', 'ffmpeg', 'beta', 'new', 'mp3', 'flac', 'm4a', 'opus', 'wav'
  ]);

  function isI18nFixed(element) {
    if (!element || element.hasAttribute('data-i18n-fixed')) return true;
    if (element.closest(DYNAMIC_EXCLUDE_SEL)) return true;
    const raw = (element.dataset.i18nEn || element.dataset.i18nEnPlaceholder || element.getAttribute('placeholder') || element.textContent || '').trim();
    if (!raw) return true;
    if (PROTECTED_BRAND_TEXTS.has(raw.toLowerCase())) return true;
    if (/^v?\d+\.\d+(\.\d+)?$/i.test(raw)) return true;
    return false;
  }

  var BUILTIN_UI_DICT = {
    ru: {
      'Search tracks, artists, or albums...': 'Поиск треков, артистов или альбомов...',
      'Search songs, artists, albums...': 'Поиск треков, артистов или альбомов...',
      'Search songs, artists, or albums...': 'Поиск треков, артистов или альбомов...',
      'Search tracks, artists, albums...': 'Поиск треков, артистов или альбомов...',
      'Top chart': 'Топ чарт',
      'Artist': 'Артист',
      'Viscosity time': 'Время тягучести',
      'Search settings...': 'Поиск настроек...',
      'Search favorites...': 'Поиск в избранном...',
      'Search my files...': 'Поиск в моих файлах...',
      'Search in playlist...': 'Поиск в плейлисте...',
      'For you': 'Для вас',
      'Radio': 'Радио',
      'Jump back in': 'Недавно слушали',
      'Home': 'Главная',
      'Plays': '▶',
      'Reset audio source': 'Сбросить источник аудио',
      'Re-search streaming tracks': 'Перепоиск треков',
      'Re-searching streaming tracks': 'Перепоиск треков',
      'No streaming tracks to re-search (local files are ignored)': 'Нет треков для перепоиска (оффлайн треки игнорируются)',
      'Updated': 'Обновлено',
      'Searching new audio source...': 'Поиск нового сурса аудио...',
      'Audio source updated!': 'Источник аудио обновлен!',
      'No alternative audio source found': 'Другой сурс не найден',
      'Failed to search new audio source': 'Не удалось найти новый источник',
      'Top moment': 'Топ момент',
      'Top moment removed': 'Топ момент удален',
      'Top moment set at': 'Топ момент установлен на',
      'Set top moment here': 'Отметить топ момент',
      'Remove top moment': 'Удалить топ момент',
      'Trim best part': 'Обрезать трек',
      'Keep in sync with source': 'Синхронизировать с источником',
      'Last synced': 'Синхронизировано',
      'Track row height': 'Высота карточки трека',
      'Top moment pin icon': 'Иконка топ момента',
      'Liked songs': 'Любимые',
      'Liked Songs': 'Любимые',
      'Favorites': 'Избранное',
      'Albums': 'Альбомы',
      'Album': 'Альбом',
      'My files': 'Мои файлы',
      'History': 'История',
      'Queue': 'Очередь',
      'Recently played': 'Недавние',
      'Now playing': 'Сейчас играет',
      'Next up': 'Далее в очереди',
      'Playlists': 'Плейлисты',
      'Top result': 'Лучший результат',
      'Presets': 'Пресеты',
      'Settings': 'Настройки',
      'All': 'Все',
      'Songs': 'Треки',
      'Artists': 'Артисты',
      'Tracks': 'Треки',
      'Popular Songs': 'Популярные треки',
      'Show all': 'Показать все',
      'Show less': 'Свернуть',
      'Follow': 'Подписаться',
      'Following': 'Вы подписаны',
      'Block': 'Заблокировать',
      'Blocked': 'Заблокирован',
      'About the artist': 'Об исполнителе',
      'Show track credits & audio source': 'Показывать авторов трека и источник аудио',
      'Display composer, lyricist, producer, and audio source in right panel': 'Отображать композитора, автора текста, продюсера и источник аудио в правой панели',
      'Show track source logo next to artist': 'Показывать логотип источника рядом с артистом',
      'Show platform badge next to artist in track lists and player bar': 'Показывать значок платформы рядом с артистом в списках треков и плеере',
      'Riff Library': 'Библиотека Riff',
      'Combines YouTube Music and SoundCloud into a single unified search source': 'Объединяет YouTube Music и SoundCloud в единый источник поиска',
      'Riff Library hybrid streaming': 'Гибридный стриминг Riff Library',
      'Cross-fallback and race YouTube Music and SoundCloud streams during playback': 'Перекрёстный фолбэк и параллельный запрос потоков YouTube Music и SoundCloud при воспроизведении',
      'Audio source': 'Источник аудио',
      'Performed by': 'Исполнитель',
      'Written by': 'Авторы',
      'Produced by': 'Продюсеры',
      'Local file': 'Локальный файл',
      'Play': 'Слушать',
      'Download all': 'Скачать всё',
      'Export as JSON': 'Экспорт в JSON',
      'Clear history': 'Очистить историю',
      'Clear queue': 'Очистить очередь',
      'Add files': 'Добавить файлы',
      'Add folder': 'Добавить папку',
      'Manual order': 'Вручную',
      'Date added (newest)': 'Сначала новые',
      'Date added (oldest)': 'Сначала старые',
      'Do you like these tracks?': 'Вам нравятся эти треки?',
      'Interface': 'Интерфейс',
      'Theme': 'Тема',
      'Banners': 'Баннеры',
      'Integrations': 'Интеграции',
      'Storage': 'Хранилище',
      'Advanced': 'Расширенные',
      'About': 'О приложении',
      'Custom themes': 'Кастомные темы',
      'Plugins': 'Плагины',
      'Account': 'Аккаунт',
      'Display name': 'Отображаемое имя',
      'Reset avatar': 'Сбросить аватар',
      'Account backup (.rfacc)': 'Резервная копия аккаунта (.rfacc)',
      'Export Riff account (.rfacc)': 'Экспорт аккаунта Riff (.rfacc)',
      'Import Riff account (.rfacc)': 'Импорт аккаунта Riff (.rfacc)',
      'Save your profile, playlists, favorites, history, and settings to a file': 'Сохраните профиль, плейлисты, избранное, историю и настройки в файл',
      'Restore your entire Riff account from a .rfacc backup file': 'Восстановите весь аккаунт Riff из файла резервной копии .rfacc',
      'Connected services & integrations': 'Подключённые сервисы и интеграции',
      'Manage Spotify, YouTube, Last.fm, Yandex Music, and Discord RPC': 'Управление Spotify, YouTube, Last.fm, Яндекс Музыкой и Discord RPC',
      'Open Integrations': 'Открыть интеграции',
      'Interface language': 'Язык интерфейса',
      'Hide top titlebar': 'Скрыть верхнюю панель окна',
      'Hide the window titlebar and reveal it on top edge hover': 'Скрывает заголовок окна и показывает его при наведении на верхний край',
      'Auto-hide timeline timestamps': 'Автоскрытие времени трека',
      'Fade out current time and duration on the player bar when idle': 'Плавно скрывать время трека в нижней панели в покое',
      'UI scale': 'Масштаб интерфейса',
      'Font scale': 'Масштаб шрифта',
      'Interface font': 'Шрифт интерфейса',
      'Icon style': 'Стиль иконок',
      'Choose the icon pack used across navigation and player controls': 'Выберите набор иконок для навигации и плеера',
      'Position of searchbar': 'Позиция строки поиска',
      'Search engine': 'Поисковый движок',
      'Show YouTube platform': 'Показывать платформу YouTube',
      'Not recommended: regular YouTube includes non-music videos and loads slower than YouTube Music': 'Не рекомендуется: на обычном YouTube много видео не с музыкой и треки грузятся дольше',
      'Compact engine buttons': 'Компактные кнопки платформ',
      'Hide engine buttons': 'Скрыть кнопки платформ',
      'Corner radius': 'Скругление углов',
      'Interface opacity': 'Прозрачность интерфейса',
      'Text opacity': 'Прозрачность текста',
      'Floating panels blur': 'Размытие всплывающих панелей',
      'No-Hand cursor': 'Обычный курсор вместо руки',
      'Show wave visualizer in bottom bar': 'Волновой визуализатор в нижней панели',
      'Playbar visualizer position': 'Позиция визуализатора',
      'Compact': 'Компактный',
      'Behind bar': 'За панелью',
      'Connected liquid visualizer': 'Слитный жидкий визуализатор',
      'Shaped cover in the bottom bar': 'Фигурная обложка в нижней панели',
      'Shaped covers in Now Playing & Karaoke': 'Фигурные обложки в Now Playing и Караоке',
      'Show explicit tag [E] on tracks': 'Показывать метку [E] на треках',
      'Performance mode': 'Режим производительности',
      'Customize sidebar & home layout': 'Настройка сайдбара и главной',
      'Theme mode': 'Режим темы',
      'Light': 'Светлая',
      'Dark': 'Тёмная',
      'Auto (album)': 'Авто (обложка)',
      'Palette style': 'Стиль палитры',
      'Accent color': 'Акцентный цвет',
      'Intensity': 'Насыщенность',
      'Apply intensity to background': 'Применять насыщенность к фону',
      'Tint background and surface panels with the accent color and intensity': 'Окрашивать фон и панели в акцентный цвет',
      'Brightness': 'Яркость',
      'Highlight buttons': 'Выделять главные кнопки цветом',
      'Home button icon': 'Иконка кнопки Домой',
      'App icon on Home button': 'Иконка приложения на кнопке Домой',
      'Enable banners': 'Включить баннеры',
      'Track banners': 'Баннеры треков',
      'Cover background': 'Фон из обложки трека',
      'Show artists in search': 'Показывать артистов в поиске',
      'Show My files tab': 'Показывать вкладку Мои файлы',
      'Show Albums tab': 'Показывать вкладку Альбомы',
      'Smooth preset transitions': 'Плавный переход пресетов',
      'Save sound settings': 'Сохранять настройки звука',
      'Wavy progress bar': 'Волнистый прогресс-бар',
      'Progress bar knob': 'Ползунок прогресс-бара',
      'Progress bar background': 'Фон прогресс-бара',
      'Classic rounded track cards': 'Классические скругленные карточки треков',
      'Audio output device': 'Устройство вывода звука',
      'System default': 'По умолчанию в системе',
      'Crossfade': 'Кроссфейд',
      'Lyrics translation': 'Перевод текста песен',
      'Translation language': 'Язык перевода',
      'Auto-translate': 'Автоперевод',
      'Lyrics animation': 'Анимация текста песен',
      'Lyrics source': 'Источник текста песен',
      'Clear cache': 'Очистить кэш',
      'Required tools': 'Необходимые компоненты',
      'Offline library': 'Офлайн-библиотека',
      'Music folder': 'Папка с музыкой',
      'Download folder': 'Папка загрузок',
      'Check for updates': 'Проверить обновления',
      'Keyboard shortcuts': 'Горячие клавиши',
      'Diagnostics': 'Диагностика',
      'Logs': 'Логи',
      'Create playlist': 'Создать плейлист',
      'Cancel': 'Отмена',
      'Create': 'Создать',
      'Save': 'Сохранить',
      'Close': 'Закрыть',
      'Reset': 'Сбросить',
      'Import': 'Импорт',
      'Export': 'Экспорт',
      'Enhancer': 'Улучшение',
      'Speed & Pitch': 'Скорость и тон',
      'Volume gain': 'Громкость',
      'Volume Gain': 'Громкость',
      'Pitch': 'Питч',
      'Distortion': 'Бассбуст',
      'Audio FX': 'Эффекты',
      'Equalizer': 'Эквалайзер',
      'Sleep': 'Таймер сна',
      'Sleep timer': 'Таймер сна',
      'Reset audio settings': 'Сбросить настройки звука',
      'Pin to sidebar': 'Закрепить в сайдбаре',
      'Unpin from sidebar': 'Открепить из сайдбара',
      'Add to library': 'Добавить в библиотеку',
      'Remove from library': 'Удалить из библиотеки',
      'Added to library': 'Добавлено в библиотеку',
      'Removed from library': 'Удалено из библиотеки',
      'Add to playlist': 'Добавить в плейлист',
      'Add to queue': 'Добавить в очередь',
      'Share link': 'Поделиться ссылкой',
      'Download': 'Скачать',
      'Change banner': 'Изменить баннер',
      'Rename track': 'Переименовать трек',
      'Block track': 'Заблокировать трек',
      'Block artist': 'Заблокировать артиста',
      'Track was removed from the platform, so a cover or remix may play': 'Трек был удалён с платформы, поэтому может играть кавер/ремикс',
      'Playlist synchronization': 'Синхронизация плейлиста',
      'Last synchronization': 'Последняя синхронизация',
      'Click to sync now': 'Нажмите для синхронизации',
      'Reset recommendations': 'Сбросить рекомендации',
      'Reset Daily Mix and For you data without deleting history or favorites': 'Сбросить данные Daily Mix и Для вас без удаления истории или избранного',
      'Recommendations reset': 'Рекомендации сброшены',
      'Blurred cover background': 'Размытая обложка на фоне',
      'Playlist & Now Playing banners': 'Баннеры в плейлистах и Now Playing',
      'Now Playing cover banner': 'Баннер обложки в Now Playing',
      'Custom app background': 'Свой фон приложения',
      'Custom banner media': 'Свой файл баннера',
      'Custom background blur': 'Размытие своего фона',
      'Custom background opacity': 'Прозрачность своего фона',
      'Show visualizer in Now Playing panel': 'Визуализатор в панели Now Playing',
      'Remove from playlist': 'Удалить из плейлиста',
      'Remove from queue': 'Удалить из очереди',
      'Remove from Riff': 'Удалить из Riff',
      'Favorite': 'В избранное',
      'Remove from Favorites': 'Удалить из избранного',
      'Pin to top': 'Закрепить наверху',
      'Unpin': 'Открепить',
      'Unblock track': 'Разблокировать трек',
      'Unblock artist': 'Разблокировать артиста',
      'Search in playlist': 'Поиск в плейлисте',
      'Search favorites': 'Поиск в избранном',
      'Search my files': 'Поиск в моих файлах',
      'Search in Your Library': 'Поиск в вашей медиатеке',
      'Search in your library': 'Поиск в вашей медиатеке',
      'Search language...': 'Поиск языка...',
      'Search': 'Поиск',
      'Sort playlist': 'Сортировка плейлиста',
      'Sort favorites': 'Сортировка избранного',
      'Rename playlist': 'Переименовать плейлист',
      'Visualizer style': 'Стиль визуализатора',
      'Choose between standard equalizer bars, connected liquid wave, or Swift': 'Выберите между стандартными столбцами эквалайзера, слитной жидкой волной или Swift',
      'Bars (Default)': 'Столбцы (по умолчанию)',
      'Wave': 'Волна',
      'Swift': 'Swift',
      'No-lyrics visualizer': 'Визуализатор без текста'
    },
    uk: {
      'Search tracks, artists, or albums...': 'Пошук треків, артистів або альбомів...',
      'Search songs, artists, albums...': 'Пошук треків, артистів або альбомів...',
      'Search songs, artists, or albums...': 'Пошук треків, артистів або альбомів...',
      'Search tracks, artists, albums...': 'Пошук треків, артистів або альбомів...',
      'Top chart': 'Топ чарт',
      'Artist': 'Артист',
      'Viscosity time': 'Час тягучості',
      'Search settings...': 'Пошук налаштувань...',
      'Search favorites...': 'Пошук в обраному...',
      'Search my files...': 'Пошук у моїх файлах...',
      'Search in playlist...': 'Пошук у плейлисті...',
      'For you': 'Для вас',
      'Radio': 'Радіо',
      'Jump back in': 'Нещодавно слухали',
      'Home': 'Головна',
      'Trending now': 'Зараз у тренді',
      'Favorite artists': 'Улюблені виконавці',
      'Liked songs': 'Лайки',
      'Liked Songs': 'Лайки',
      'Favorites': 'Обране',
      'Albums': 'Альбоми',
      'Album': 'Альбом',
      'My files': 'Мої файли',
      'History': 'Історія',
      'Queue': 'Черга',
      'Recently played': 'Нещодавні',
      'Now playing': 'Зараз грає',
      'Next up': 'Далі в черзі',
      'Playlists': 'Плейлисти',
      'Top result': 'Найкращий результат',
      'Presets': 'Пресети',
      'Settings': 'Налаштування',
      'All': 'Усі',
      'Songs': 'Треки',
      'Artists': 'Артисти',
      'Tracks': 'Треки',
      'Popular Songs': 'Популярні треки',
      'Show all': 'Показати всі',
      'Show less': 'Згорнути',
      'Follow': 'Підписатися',
      'Following': 'Ви підписані',
      'Block': 'Заблокувати',
      'Blocked': 'Заблоковано',
      'About the artist': 'Про виконавця',
      'Riff Library': 'Бібліотека Riff',
      'Combines YouTube Music and SoundCloud into a single unified search source': 'Об’єднує YouTube Music та SoundCloud в єдине джерело пошуку',
      'Riff Library hybrid streaming': 'Гібридний стрімінг Riff Library',
      'Cross-fallback and race YouTube Music and SoundCloud streams during playback': 'Перехресний фолбек і паралельний запит потоків YouTube Music та SoundCloud при відтворенні',
      'Play': 'Слухати',
      'Download all': 'Завантажити все',
      'Export as JSON': 'Експорт у JSON',
      'Clear history': 'Очистити історію',
      'Clear queue': 'Очистити чергу',
      'Add files': 'Додати файли',
      'Add folder': 'Додати папку',
      'Do you like these tracks?': 'Вам подобаються ці треки?',
      'Interface': 'Інтерфейс',
      'Theme': 'Тема',
      'Banners': 'Банери',
      'Integrations': 'Інтеграції',
      'Storage': 'Сховище',
      'Advanced': 'Розширені',
      'About': 'Про застосунок',
      'Custom themes': 'Власні теми',
      'Plugins': 'Плагіни',
      'Account': 'Акаунт',
      'Display name': 'Імʼя користувача',
      'Reset avatar': 'Скинути аватар',
      'Account backup (.rfacc)': 'Резервна копія акаунту (.rfacc)',
      'Export Riff account (.rfacc)': 'Експорт акаунту Riff (.rfacc)',
      'Import Riff account (.rfacc)': 'Імпорт акаунту Riff (.rfacc)',
      'Save your profile, playlists, favorites, history, and settings to a file': 'Збережіть профіль, плейлісти, улюблене, історію та налаштування у файл',
      'Restore your entire Riff account from a .rfacc backup file': 'Відновіть увесь акаунт Riff з файлу резервної копії .rfacc',
      'Connected services & integrations': 'Підключені сервіси та інтеграції',
      'Manage Spotify, YouTube, Last.fm, Yandex Music, and Discord RPC': 'Керування Spotify, YouTube, Last.fm, Яндекс Музикою та Discord RPC',
      'Open Integrations': 'Відкрити інтеграції',
      'Interface language': 'Мова інтерфейсу',
      'Hide top titlebar': 'Приховати верхню панель вікна',
      'Auto-hide timeline timestamps': 'Автоприховування часу треку',
      'UI scale': 'Масштаб інтерфейсу',
      'Font scale': 'Масштаб шрифту',
      'Interface font': 'Шрифт інтерфейсу',
      'Icon style': 'Стиль іконок',
      'Position of searchbar': 'Позиція рядка пошуку',
      'Search engine': 'Пошукова система',
      'Corner radius': 'Заокруглення кутів',
      'Interface opacity': 'Прозорість інтерфейсу',
      'Floating panels blur': 'Розмиття спливаючих панелей',
      'Performance mode': 'Режим продуктивності',
      'Theme mode': 'Режим теми',
      'Light': 'Світла',
      'Dark': 'Темна',
      'Auto (album)': 'Авто (обкладинка)',
      'Accent color': 'Акцентний колір',
      'Intensity': 'Насиченість',
      'Brightness': 'Яскравість',
      'Check for updates': 'Перевірити оновлення',
      'Keyboard shortcuts': 'Гарячі клавіші',
      'Diagnostics': 'Діагностика',
      'Logs': 'Логи',
      'Create playlist': 'Створити плейлист',
      'Cancel': 'Скасувати',
      'Create': 'Створити',
      'Save': 'Зберегти',
      'Close': 'Закрити',
      'Reset': 'Скинути',
      'Pin to sidebar': 'Закріпити в сайдбарі',
      'Unpin from sidebar': 'Відкріпити з сайдбару',
      'Add to library': 'Додати до бібліотеки',
      'Remove from library': 'Видалити з бібліотеки',
      'Added to library': 'Додано до бібліотеки',
      'Removed from library': 'Видалено з бібліотеки',
      'Track was removed from the platform, so a cover or remix may play': 'Трек був видалений з платформи, тому може грати кавер/ремікс',
      'Playlist synchronization': 'Синхронізація плейлиста',
      'Last synchronization': 'Остання синхронізація',
      'Click to sync now': 'Натисніть для синхронізації',
      'Reset recommendations': 'Скинути рекомендації',
      'Reset Daily Mix and For you data without deleting history or favorites': 'Скинути дані Daily Mix та Для вас без видалення історії або обраного',
      'Recommendations reset': 'Рекомендації скинуто',
      'Remove from playlist': 'Видалити з плейлиста',
      'Remove from queue': 'Видалити з черги',
      'Remove from Riff': 'Видалити з Riff',
      'Favorite': 'В обране',
      'Remove from Favorites': 'Видалити з обраного',
      'Pin to top': 'Закріпити вгорі',
      'Unpin': 'Відкріпити',
      'Unblock track': 'Розблокувати трек',
      'Unblock artist': 'Розблокувати артиста',
      'Add to playlist': 'Додати до плейлиста',
      'Add to queue': 'Додати до черги',
      'Share link': 'Поділитися посиланням',
      'Download': 'Завантажити',
      'Change banner': 'Змінити банер',
      'Rename track': 'Перейменувати трек',
      'Reset audio source': 'Скинути джерело аудіо',
      'Re-search streaming tracks': 'Перепошук стрімінгових треків',
      'Re-searching streaming tracks': 'Перепошук стрімінгових треків',
      'No streaming tracks to re-search (local files are ignored)': 'Немає стрімінгових треків для перепошуку (локальні файли ігноруються)',
      'Updated': 'Оновлено',
      'Top moment': 'Топ момент',
      'Top moment removed': 'Топ момент видалено',
      'Top moment set at': 'Топ момент встановлено на',
      'Set top moment here': 'Відзначити топ момент',
      'Remove top moment': 'Видалити топ момент',
      'Block track': 'Заблокувати трек',
      'Block artist': 'Заблокувати артиста',
      'Search in playlist': 'Пошук у плейлисті',
      'Search favorites': 'Пошук в обраному',
      'Search my files': 'Пошук у моїх файлах',
      'Search in Your Library': 'Пошук у вашій медіатеці',
      'Search in your library': 'Пошук у вашій медіатеці',
      'Search settings...': 'Пошук налаштувань...',
      'Search language...': 'Пошук мови...',
      'Search': 'Пошук',
      'Sort playlist': 'Сортування плейлиста',
      'Sort favorites': 'Сортування обраного',
      'Rename playlist': 'Перейменувати плейлист',
      'Visualizer style': 'Стиль візуалізатора',
      'Choose between standard equalizer bars, connected liquid wave, or Swift': 'Оберіть між стандартними стовпчиками еквалайзера, суцільною рідкою хвилею або Swift',
      'Bars (Default)': 'Стовпчики (за замовчуванням)',
      'Wave': 'Хвиля',
      'Swift': 'Swift',
      'No-lyrics visualizer': 'Візуалізатор без тексту'
    }
  };

  var REVERSE_TO_EN = {};
  for (const l of ['ru', 'uk']) {
    for (const [enK, trV] of Object.entries(BUILTIN_UI_DICT[l])) {
      REVERSE_TO_EN[trV] = enK;
    }
  }


  async function fetchAndApplyTranslation() {
    if (!state.currentTrack || !state.syncedLyrics || state.syncedLyrics.length === 0) return;
    const track = state.currentTrack;
    const lang = state.trLang || 'en';
    const cacheKey = `${track.title || ''}|${track.artist || ''}|${lang}`.toLowerCase();

    if (lyricsTranslationCache.has(cacheKey)) {
      state.currentTranslations = lyricsTranslationCache.get(cacheKey);
      renderLyricsView();
      if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
      if (typeof layoutLyricsCascade === 'function') layoutLyricsCascade(state.lastActiveLyricIdx, true);
      return;
    }

    const texts = state.syncedLyrics.map(l => l.text);
    try {
      const deeplKey = localStorage.getItem('riff_deepl_api_key') || '';
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, targetLang: lang, apiKey: deeplKey })
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.translations)) {
        lyricsTranslationCache.set(cacheKey, data.translations);
        const curKey = `${(state.currentTrack && state.currentTrack.title) || ''}|${(state.currentTrack && state.currentTrack.artist) || ''}|${state.trLang || 'en'}`.toLowerCase();
        if (curKey === cacheKey && state.trActive) {
          state.currentTranslations = data.translations;
          renderLyricsView();
          if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
          if (typeof layoutLyricsCascade === 'function') layoutLyricsCascade(state.lastActiveLyricIdx, true);
        }
      }
    } catch (e) {
      console.error('Translation error:', e);
    }
  }

  function updateLyricsTranslationUI() {
    if (el.btnTrEnabled) el.btnTrEnabled.classList.toggle('active', !!state.trEnabled);
    if (el.selectTrLang) el.selectTrLang.value = state.trLang || 'en';
    const trLangMenu = document.getElementById('tr-lang-menu');
    const trLangLabel = document.getElementById('tr-lang-label');
    const curLang = state.trLang || 'en';
    if (trLangMenu) {
      trLangMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
        const isSel = opt.dataset.value === curLang;
        opt.classList.toggle('selected', isSel);
        if (isSel && trLangLabel) trLangLabel.textContent = opt.textContent;
      });
    }
    if (trLangLabel && (!trLangMenu || !trLangMenu.querySelector('.m3-dropdown-option.selected'))) {
      const found = TRANSLATION_LANGUAGES.find(l => l.code === curLang);
      if (found) trLangLabel.textContent = `${found.flag} ${found.name} (${found.code})`;
    }
    if (el.btnTrAuto) el.btnTrAuto.classList.toggle('active', !!state.trAuto);
    if (el.btnTranslateLyrics) {
      el.btnTranslateLyrics.classList.toggle('hidden', !state.trEnabled);
      el.btnTranslateLyrics.classList.toggle('active', !!state.trActive);
    }
  }

  var CUSTOM_SHIFT_LEAD_SECONDS = 4.0;

  function getLineStartTime(idx) {
    const lines = state.syncedLyrics;
    if (idx < 0 || idx >= lines.length) return -1;
    const raw = lines[idx].time;
    if (raw < 0) return -1;
    if (!state.isCustomLyrics) return raw;
    for (let j = idx - 1; j >= 0; j--) {
      if (lines[j].time >= 0) return lines[j].time;
    }
    return Math.max(0, raw - CUSTOM_SHIFT_LEAD_SECONDS);
  }

  function getLineEndTime(idx) {
    const start = getLineStartTime(idx);
    const lines = state.syncedLyrics;
    for (let j = idx + 1; j < lines.length; j++) {
      const t = getLineStartTime(j);
      if (t >= 0) return t;
    }
    const audioDur = (el.nativeAudio && el.nativeAudio.duration) || (audioEngine && audioEngine.getDuration && audioEngine.getDuration()) || 0;
    if (audioDur > start) return audioDur;
    return start + 4.0;
  }

  function updateActiveGapProgress(gapEl, time) {
    if (!gapEl || !state.syncedLyrics) return;
    const lineIdx = gapEl.id ? parseInt(gapEl.id.replace('lyric-line-', ''), 10) : -1;
    if (lineIdx < 0 || !state.syncedLyrics[lineIdx]?.isGap) return;
    const start = getLineStartTime(lineIdx);
    const end = getLineEndTime(lineIdx);
    const dur = Math.max(0.1, end - start);
    const lookAhead = state.isCustomLyrics ? 0.25 : 0.0;
    const effectiveTime = (state.isPlaying && typeof getSmoothAudioTime === 'function')
      ? (getSmoothAudioTime() + lookAhead)
      : ((time !== undefined && time !== null) ? time : ((el.nativeAudio ? el.nativeAudio.currentTime : 0) + lookAhead));
    const progress = Math.min(1, Math.max(0, (effectiveTime - start) / dur));
    const pct = progress >= 0.999 ? 'calc(100% + 24px)' : (progress * 100).toFixed(2) + '%';
    if (gapEl.style.getPropertyValue('--gap-pct') !== pct) {
      gapEl.style.setProperty('--gap-pct', pct);
    }
  }

  function customBezierEase(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0, hi = 1, s = t;
    for (let i = 0; i < 14; i++) {
      s = (lo + hi) / 2;
      const inv = 1 - s;
      const x = (3 * inv * inv * s * 0.786) + (s * s * s);
      if (x < t) lo = s; else hi = s;
    }
    const inv = 1 - s;
    return (3 * inv * inv * s * 0.648) + (3 * inv * s * s * 0.935) + (s * s * s);
  }

  var LYRIC_EASINGS = {
    inout: { css: 'cubic-bezier(0.786, 0.648, 0, 0.935)', fn: customBezierEase },
    quad: { css: 'cubic-bezier(0.45, 0, 0.55, 1)', fn: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) },
    sine: { css: 'cubic-bezier(0.37, 0, 0.63, 1)', fn: (t) => -(Math.cos(Math.PI * t) - 1) / 2 },
    out: { css: 'cubic-bezier(0.22, 1, 0.36, 1)', fn: (t) => 1 - Math.pow(1 - t, 4) },
    outsine: { css: 'cubic-bezier(0.39, 0.575, 0.565, 1)', fn: (t) => Math.sin((t * Math.PI) / 2) },
    expo: { css: 'cubic-bezier(0.16, 1, 0.3, 1)', fn: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)) },
    linear: { css: 'linear', fn: (t) => t }
  };
  function getLyricsEase() {
    const v = localStorage.getItem('riff_lyrics_ease');
    return LYRIC_EASINGS[v] ? v : 'inout';
  }
  function getLyricsSpeed() {
    const v = parseFloat(localStorage.getItem('riff_lyrics_speed'));
    return (v >= 0.5 && v <= 2.5) ? v : 1.0;
  }
  function applyLyricsEase() {
    const ease = LYRIC_EASINGS[getLyricsEase()] || LYRIC_EASINGS.inout;
    document.documentElement.style.setProperty('--lyric-ease', ease.css);
    const speed = getLyricsSpeed();
    const baseDuration = getLyricsEase() === 'inout' ? 0.48 : 0.45;
    document.documentElement.style.setProperty('--lyric-duration', `${(baseDuration / speed).toFixed(2)}s`);
  }
  function getLyricsGradientTightness() {
    const v = parseInt(localStorage.getItem('riff_lyrics_gradient_tightness') || localStorage.getItem('riff_gradient_tight'), 10);
    return (v >= 0 && v <= 40) ? v : 2;
  }
  function applyLyricsGradientTightness() {
    const span = getLyricsGradientTightness();
    document.documentElement.style.setProperty('--lyric-gradient-span', `${span}%`);
    document.documentElement.style.setProperty('--lyric-gradient-full', `${100 + span}%`);
    document.documentElement.style.setProperty('--lyric-fw', `${span}%`);
  }
  lyricsScrollRaf = 0;
  function animateLyricsScroll(container, target) {
    cancelAnimationFrame(lyricsScrollRaf);
    const from = container.scrollTop;
    const delta = target - from;
    if (Math.abs(delta) < 1) return;
    const ease = (LYRIC_EASINGS[getLyricsEase()] || LYRIC_EASINGS.inout).fn;
    const speed = getLyricsSpeed();
    const duration = Math.max(160, Math.min(480, 320 + Math.abs(delta) * 0.28)) / speed;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      container.scrollTop = from + delta * ease(t);
      if (t < 1) lyricsScrollRaf = requestAnimationFrame(step);
    };
    lyricsScrollRaf = requestAnimationFrame(step);
  }
  if (el.lyricsContainer) {
    el.lyricsContainer.addEventListener('wheel', handleLyricsWheel, { passive: false });
    ['touchstart', 'pointerdown'].forEach((ev) => el.lyricsContainer.addEventListener(ev, () => cancelAnimationFrame(lyricsScrollRaf), { passive: true }));
  }
  if (el.tvKaraokeContent) {
    el.tvKaraokeContent.addEventListener('wheel', handleLyricsWheel, { passive: false });
  }
  applyLyricsEase();
  applyLyricsGradientTightness();

  var PUNCT_OR_SPACE_REGEX = /^[\s\p{P}]$/u;
  var CJK_REGEX = /^[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}]$/u;
  var MARK_REGEX = /^\p{M}$/u;
  var CYRILLIC_VOWELS = new Set('аеёиоуыэюяєіїўѣѵѫѧѩѭ');
  var LATIN_VOWEL_EXTRA = new Set(['æ', 'ø', 'œ', 'ı']);

  function getEffectiveLineDuration(idx) {
    const start = getLineStartTime(idx);
    const rawDur = Math.max(0.45, getLineEndTime(idx) - start);
    const breathTail = rawDur > 2.2 ? Math.min(0.12, rawDur * 0.03) : 0;
    return Math.max(0.40, rawDur - breathTail);
  }

  function computeEstimatedWordIndex(wordSpans, matchTime, lineIdx) {
    const totalWords = wordSpans.length;
    if (totalWords === 0) return -1;
    const start = getLineStartTime(lineIdx);
    const effDur = getEffectiveLineDuration(lineIdx);
    const elapsed = matchTime - start;
    if (elapsed <= 0) return 0;
    if (elapsed >= effDur) return totalWords - 1;
    const tau = elapsed / effDur;
    const weights = new Float32Array(totalWords);
    let sumW = 0;
    for (let i = 0; i < totalWords; i++) {
      const txt = (wordSpans[i].textContent || '').trim();
      const cleanChars = txt.replace(/[\s\p{P}]/gu, '');
      let w = Math.max(1.4, cleanChars.length * 0.55);

      const isStandaloneDash = /^[\u2012\u2013\u2014\u2015\-]/.test(txt) && cleanChars.length === 0;
      const hasDash = /[\u2012\u2013\u2014\u2015\-]/.test(txt);
      const hasStrongPunct = /[.!?。！？…]+|\.{2,}/.test(txt);
      const hasMediumPunct = /[,;:、，；]/.test(txt);

      if (isStandaloneDash) {
        w = 2.6;
      } else {
        if (hasStrongPunct) {
          w += 3.2;
        } else if (hasDash) {
          w += 2.8;
        } else if (hasMediumPunct) {
          w += 2.0;
        }
      }

      if (i === totalWords - 1) {
        w += 1.2;
      }

      weights[i] = w;
      sumW += w;
    }
    const target = tau * sumW;
    let acc = 0;
    for (let i = 0; i < totalWords; i++) {
      acc += weights[i];
      if (target <= acc) return i;
    }
    return totalWords - 1;
  }

  function getCharBaseWeight(c, nextChar = '') {
    if (c === ',' || c === ';' || c === ':' || c === '、' || c === '，' || c === '；') return 4.6;
    if (c === '.' || c === '!' || c === '?' || c === '—' || c === '–' || c === '-' || c === '―' || c === '‒' || c === '。' || c === '！' || c === '？' || c === '…') return 5.8;
    if (c === '.' && nextChar === '.') return 6.0;
    if (PUNCT_OR_SPACE_REGEX.test(c)) return 0.55;
    if (CJK_REGEX.test(c)) return 2.8;
    if (MARK_REGEX.test(c)) return 2.6;
    const lower = c.toLowerCase();
    if (CYRILLIC_VOWELS.has(lower)) return 2.5;
    const base = c.normalize('NFD')[0].toLowerCase();
    if ('aeiouy'.includes(base) || LATIN_VOWEL_EXTRA.has(lower)) return 2.5;
    return 1.0;
  }

  var gradientLineCache = {
    lineEl: null,
    lineIdx: -1,
    text: '',
    N: 0,
    cumWeights: null,
    totalWeight: 0
  };

  function getLineGradientWeights(lineEl, idx, text) {
    if (gradientLineCache.lineEl === lineEl && gradientLineCache.lineIdx === idx && gradientLineCache.text === text) {
      return gradientLineCache;
    }
    const chars = Array.from(text);
    const N = chars.length;
    if (N === 0) {
      gradientLineCache = { lineEl, lineIdx: idx, text, N: 0, cumWeights: null, totalWeight: 0 };
      return gradientLineCache;
    }
    const cumWeights = new Float64Array(N + 1);
    cumWeights[0] = 0;
    let total = 0;
    for (let i = 0; i < N; i++) {
      let w = getCharBaseWeight(chars[i], chars[i + 1] || '');
      if (i >= N - 2) w *= 1.18;
      total += w;
      cumWeights[i + 1] = total;
    }
    gradientLineCache = { lineEl, lineIdx: idx, text, N, cumWeights, totalWeight: total };
    return gradientLineCache;
  }

  gradientRaf = 0;
  function updateActiveGradient(targetLineEl) {
    const lineEl = targetLineEl || document.querySelector('.lyric-line.active.gradient-line');
    if (!lineEl || !el.nativeAudio) return;
    if (!lineEl._fillMain) {
      lineEl._fillMain = lineEl.querySelector('.lyric-fill-main') || lineEl.firstElementChild;
    }
    const fillMain = lineEl._fillMain;
    if (!fillMain) return;
    if (lineEl._fillParen === undefined) {
      lineEl._fillParen = lineEl.querySelector('.lyric-fill.lyric-paren');
    }
    const fillParen = lineEl._fillParen;

    const idx = parseInt(lineEl.id.replace('lyric-line-', ''), 10);
    const start = getLineStartTime(idx);
    const dur = getEffectiveLineDuration(idx);
    const t = el.nativeAudio.currentTime + (state.isCustomLyrics ? 0.25 : 0);
    const tau = Math.min(1, Math.max(0, (t - start) / dur));

    const mainStr = fillMain.textContent || '';
    const parenStr = fillParen ? (fillParen.textContent || '') : '';
    const fullText = mainStr + parenStr;
    const cache = getLineGradientWeights(lineEl, idx, fullText);

    let k = tau;
    if (cache.N > 0 && cache.totalWeight > 0) {
      if (tau <= 0) k = 0;
      else if (tau >= 1) k = 1;
      else {
        const tw = tau * cache.totalWeight;
        const cw = cache.cumWeights;
        const N = cache.N;
        let low = 0, high = N - 1, i = 0;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (cw[mid + 1] <= tw) low = mid + 1;
          else if (cw[mid] > tw) high = mid - 1;
          else { i = mid; break; }
        }
        const charWeight = cw[i + 1] - cw[i];
        const pi = charWeight > 0 ? (tw - cw[i]) / charWeight : 0;
        k = Math.min(1, Math.max(0, (i + pi) / N));
      }
    }

    if (lineEl._kwEl === undefined) {
      lineEl._kwEl = lineEl.querySelector('.lyric-keyword') || null;
    }
    if (lineEl._kwEl) {
      const rStart = parseFloat(lineEl._kwEl.dataset.kwStartRatio ?? '-1');
      const rEnd = parseFloat(lineEl._kwEl.dataset.kwEndRatio ?? '-1');
      let isKwActive = false;
      if (rStart >= 0 && rEnd >= 0) {
        isKwActive = (k >= rStart - 0.02 && k <= rEnd + 0.05);
      } else {
        const kwStart = parseFloat(lineEl._kwEl.dataset.kwStart || '0');
        const kwEnd = parseFloat(lineEl._kwEl.dataset.kwEnd || '0');
        isKwActive = (t >= kwStart - 0.02 && t <= kwEnd + 0.08);
      }
      lineEl._kwEl.classList.toggle('keyword-active', isKwActive);
    }

    if (Math.abs(k - (lineEl._lastK ?? -1)) < 0.0015) return;
    lineEl._lastK = k;

    if (fillParen && parenStr.length > 0) {
      const pStart = parseFloat(fillParen.dataset.startRatio || '0.7');
      const pEnd = Math.max(pStart + 0.1, parseFloat(fillParen.dataset.endRatio || '1.0'));
      const kMain = Math.min(1, Math.max(0, k));
      const kParen = Math.min(1, Math.max(0, (k - pStart) / (pEnd - pStart)));
      fillMain.style.setProperty('--k', kMain.toFixed(4));
      fillParen.style.setProperty('--k', kParen.toFixed(4));
    } else {
      fillMain.style.setProperty('--k', k.toFixed(4));
    }
  }
  function startGradientLoop() {}

  var CASCADE_CONFIG = {
    anchorY: 35,
    delayStep: 35,
    maxDelay: 180,
    duration: 1.15,
    bezier: 'cubic-bezier(0.22, 1, 0.36, 1)',
    blurStep: 1.3,
    maxBlur: 6,
    pastOpacity: 0.12
  };

  var manualLyricsOffset = 0;
  var manualLyricsTargetOffset = 0;
  var wheelRafId = 0;
  var wheelReturnTimer = null;

  function resetManualLyricsWheel() {
    manualLyricsTargetOffset = 0;
    manualLyricsOffset = 0;
    if (wheelRafId) {
      cancelAnimationFrame(wheelRafId);
      wheelRafId = 0;
    }
    if (wheelReturnTimer) {
      clearTimeout(wheelReturnTimer);
      wheelReturnTimer = null;
    }
    if (el.lyricsContainer) {
      el.lyricsContainer.classList.remove('lyrics-wheeling');
    }
  }

  function getLyricsOffsetBounds(container, lines) {
    if (!container || !lines || lines.length <= 1) return { min: 0, max: 0 };
    const containerH = container.clientHeight || 400;
    const anchor = containerH * (CASCADE_CONFIG.anchorY / 100);
    const firstY = lines[0]._baseY !== undefined ? lines[0]._baseY : anchor;
    const lastLine = lines[lines.length - 1];
    const lastY = (lastLine._baseY !== undefined ? lastLine._baseY : anchor) + (lastLine.offsetHeight || 32);
    const totalSpan = lastY - firstY;
    if (totalSpan <= containerH * 0.45) return { min: 0, max: 0 };
    return { min: Math.min(0, anchor - lastY + 24), max: Math.max(0, anchor - firstY) };
  }

  function applyManualWheelOffset() {
    const container = el.lyricsContainer;
    if (!container) return;
    const lines = container.querySelectorAll('.lyric-line');
    const containerH = container.clientHeight || 400;
    const anchor = containerH * (CASCADE_CONFIG.anchorY / 100);
    const isPerf = document.body.classList.contains('perf') || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line._baseY !== undefined) {
        const curY = line._baseY + manualLyricsOffset;
        line.style.setProperty('--y', `${curY.toFixed(1)}px`);
        const dist = Math.abs(curY - anchor);
        const blur = isPerf ? 0 : Math.min(dist * 0.02, 4);
        const opacity = Math.max(0.18, 0.95 - Math.min(0.77, dist * 0.0025));
        line.style.setProperty('--blur', `${blur.toFixed(2)}px`);
        line.style.setProperty('--opacity', opacity.toFixed(3));
      }
    }
  }

  function stepLyricsWheel() {
    const container = el.lyricsContainer;
    const diff = manualLyricsTargetOffset - manualLyricsOffset;
    if (Math.abs(diff) > 0.4) {
      manualLyricsOffset += diff * 0.22;
      applyManualWheelOffset();
      wheelRafId = requestAnimationFrame(stepLyricsWheel);
    } else {
      manualLyricsOffset = manualLyricsTargetOffset;
      applyManualWheelOffset();
      wheelRafId = 0;
      if (container) {
        container.classList.remove('lyrics-wheeling');
      }
      if (manualLyricsOffset === 0 && typeof layoutLyricsCascade === 'function') {
        layoutLyricsCascade(state.lastActiveLyricIdx, false);
      }
    }
  }

  function handleLyricsWheel(e) {
    const container = el.lyricsContainer;
    if (!container) return;
    e.preventDefault();
    const lines = container.querySelectorAll('.lyric-line');
    const bounds = getLyricsOffsetBounds(container, lines);
    if (bounds.min === 0 && bounds.max === 0) return;
    manualLyricsTargetOffset = Math.max(bounds.min, Math.min(bounds.max, manualLyricsTargetOffset - e.deltaY * 0.8));
    container.classList.add('lyrics-wheeling');
    if (!wheelRafId) {
      wheelRafId = requestAnimationFrame(stepLyricsWheel);
    }
    if (wheelReturnTimer) clearTimeout(wheelReturnTimer);
    wheelReturnTimer = setTimeout(() => {
      wheelReturnTimer = null;
      if (state.isPlaying) {
        manualLyricsTargetOffset = 0;
        container.classList.add('lyrics-wheeling');
        if (!wheelRafId) {
          wheelRafId = requestAnimationFrame(stepLyricsWheel);
        }
      }
    }, 3200);
  }

  function layoutLyricsCascade(activeIndex, snap = false) {
    const container = el.lyricsContainer;
    if (!container) return;
    const lines = container.querySelectorAll('.lyric-line');
    const n = lines.length;
    if (n === 0) return;

    container.style.position = 'relative';

    const containerW = container.clientWidth;
    const heights = new Array(n);
    for (let i = 0; i < n; i++) {
      const line = lines[i];
      if (!line._cachedH || container._lastCascadeW !== containerW) {
        line._cachedH = line.offsetHeight;
      }
      heights[i] = line._cachedH;
    }
    container._lastCascadeW = containerW;

    const containerH = container.clientHeight || container.parentElement?.clientHeight || 400;
    const a = activeIndex >= 0 ? Math.min(activeIndex, n - 1) : 0;
    const anchor = containerH * (CASCADE_CONFIG.anchorY / 100);
    const tvElement = el.tvKaraoke || document.getElementById('tv-karaoke');
    const isTvk = !!(state.isTvKaraokeOpen || (tvElement && tvElement.contains(container)));
    let baseGap = 16;
    if (isTvk) {
      const tvkS = typeof getTvk === 'function' ? getTvk() : null;
      const rawG = tvkS && tvkS.gap !== undefined ? Number(tvkS.gap) : 16;
      baseGap = (!isNaN(rawG) ? rawG : 16) * 2;
    }
    const extraMargin = baseGap * 1.0;

                         
    const targets = new Array(n);

    let y = anchor;
    for (let i = a; i < n; i++) {
      const dist = activeIndex >= 0 ? (i - a) : i;
      targets[i] = { y, dist, past: false };
      y += heights[i] + baseGap + (i === a ? extraMargin : 0);
    }

    y = anchor;
    for (let i = a - 1; i >= 0; i--) {
      y -= heights[i] + baseGap;
      const dist = activeIndex >= 0 ? (a - i) : (i + 1);
      targets[i] = { y, dist, past: true };
    }

                      
    const isPerf = document.body.classList.contains('perf') || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (snap) {
      container.classList.add('no-transition');
    }

    for (let i = 0; i < n; i++) {
      const line = lines[i];
      const t = targets[i];
      line._baseY = t.y;
      const finalY = Math.round(t.y + manualLyricsOffset);
      const delay = isPerf ? 0 : Math.min(t.dist * CASCADE_CONFIG.delayStep, CASCADE_CONFIG.maxDelay);
      const blur = (isPerf || t.dist === 0) ? 0 : Math.min(t.dist * CASCADE_CONFIG.blurStep, CASCADE_CONFIG.maxBlur);
      const opacity = t.dist === 0 ? 1 : (t.past ? CASCADE_CONFIG.pastOpacity : Math.max(0.45 - t.dist * 0.1, 0.08));

      if (line._lastFinalY !== finalY) {
        line._lastFinalY = finalY;
        line.style.setProperty('--y', `${finalY}px`);
      }
      if (line._lastBlur !== blur) {
        line._lastBlur = blur;
        line.style.setProperty('--blur', `${blur.toFixed(2)}px`);
      }
      const opStr = opacity.toFixed(3);
      if (line._lastOpacity !== opStr) {
        line._lastOpacity = opStr;
        line.style.setProperty('--opacity', opStr);
      }
      if (line._lastDelay !== delay) {
        line._lastDelay = delay;
        line.style.setProperty('--delay', `${delay}ms`);
      }
      if (!line._hasDur) {
        line.style.setProperty('--duration', `${CASCADE_CONFIG.duration}s`);
        line.style.setProperty('--bezier', CASCADE_CONFIG.bezier);
        line._hasDur = true;
      }
    }

    if (snap) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          container.classList.remove('no-transition');
        });
      });
    }
  }

  function updateSyncedLyricsHighlight(currentTime) {
    if (typeof updateMiniLyricsHighlight === 'function') updateMiniLyricsHighlight(currentTime);
    if (!state.syncedLyrics || state.syncedLyrics.length === 0 || !state.isWindowVisible) return;

    const validLines = getCachedValidLines();
    const lookAhead = state.isCustomLyrics ? 0.25 : 0.0;
    const matchTime = currentTime + lookAhead;
    const activeIndex = findActiveLineIndex(validLines, matchTime);
    const activeIdx = activeIndex;

    if (activeIndex >= 0 && state.isPlaying) {
      const line = state.syncedLyrics[activeIndex];
      const currentLineTime = getLineStartTime(activeIndex);
      const nextLineTime = getLineEndTime(activeIndex);
      const lineDur = Math.max(0.5, nextLineTime - currentLineTime);
      const progress = Math.min(Math.max((matchTime - currentLineTime) / lineDur, 0), 0.999);

      if (line) {
        if (!line._wordsList) {
          line._wordsList = (line.text || '').replace(/<[^>]+>/g, '').trim().split(/\s+/).filter(Boolean);
        }
        const words = line._wordsList;
        const totalWords = words.length;
        const currentWordIndex = totalWords > 0 ? Math.floor(progress * totalWords) : 0;
        const activeWordText = totalWords > 0 ? words[currentWordIndex] : '';

        const stateKey = `${activeIndex}-${currentWordIndex}`;
        if (state.lastBroadcastStateKey !== stateKey) {
          state.lastBroadcastStateKey = stateKey;
          throttledSendStateToServer(activeWordText, currentWordIndex, activeIndex);
        }
      }
    }

    const parent = el.lyricsContainer;
    const hasLayout = !!(parent && parent.clientHeight >= 40);
    const lineChanged = state.lastActiveLyricIdx !== activeIndex || state.forceLyricsScroll;
    const shouldSnap = state.forceSnapLyrics;

    if (lineChanged && state.lastActiveLyricIdx !== activeIndex) {
      resetManualLyricsWheel();
    }

    if (hasLayout && (lineChanged || shouldSnap)) {
      if (getAdv('lyrics_autoscroll', true)) {
        layoutLyricsCascade(activeIndex, shouldSnap);
      } else if (shouldSnap) {
        layoutLyricsCascade(activeIndex, true);
      }
      state.forceLyricsScroll = false;
      state.forceSnapLyrics = false;
      state.lastActiveLyricIdx = activeIndex;
    } else if (hasLayout && !state.forceLyricsScroll) {
      state.lastActiveLyricIdx = activeIndex;
    }

    const updateActiveLineWords = (lineEl, idx) => {
      if (!lineEl) return;
      if (isGradientMode()) {
        updateActiveGradient(lineEl);
        return;
      }
      if (lineEl._kwEl === undefined) {
        lineEl._kwEl = lineEl.querySelector('.lyric-keyword') || null;
      }
      if (lineEl._kwEl) {
        const kwStart = parseFloat(lineEl._kwEl.dataset.kwStart || '0');
        const kwEnd = parseFloat(lineEl._kwEl.dataset.kwEnd || '0');
        const isKwActive = (currentTime >= kwStart - 0.02 && currentTime <= kwEnd + 0.08);
        lineEl._kwEl.classList.toggle('keyword-active', isKwActive);
      }
      if (getAdv('karaoke_words', true) && state.lyricsMode === 'word') {
        const line = state.syncedLyrics[idx];
        if (line && line.words && Array.isArray(line.words) && line.words.length > 0) {
          if (!lineEl._wordSpans) lineEl._wordSpans = lineEl.querySelectorAll('.lyric-word');
          const wordSpans = lineEl._wordSpans;
          for (let wIdx = 0; wIdx < wordSpans.length; wIdx++) {
            const wSpan = wordSpans[wIdx];
            const w = line.words[wIdx];
            const wStart = w ? (w.start !== undefined ? w.start : (w.time || 0)) : 0;
            const wEnd = w ? (w.end !== undefined ? w.end : (w.endTime || getLineEndTime(idx))) : getLineEndTime(idx);
            const isP = wSpan.classList.contains('lyric-paren') ? ' lyric-paren' : '';
            const isKw = wSpan.classList.contains('lyric-keyword');
            const isWordActive = (currentTime >= wStart && currentTime < wEnd);
            const isKwActive = (isKw && isWordActive) ? ' keyword-active' : '';
            const kwCls = isKw ? ' lyric-keyword' : '';
            const nextCls = (currentTime >= wEnd ? 'lyric-word past-word' : (isWordActive ? 'lyric-word active-word' : 'lyric-word')) + isP + kwCls + isKwActive;
            if (wSpan.className !== nextCls) wSpan.className = nextCls;
          }
        } else {
          if (!lineEl._wordSpans) lineEl._wordSpans = lineEl.querySelectorAll('.lyric-word');
          const wordSpans = lineEl._wordSpans;
          const currentWordIndex = computeEstimatedWordIndex(wordSpans, matchTime, idx);
          if (lineEl._lastWordIdx !== currentWordIndex) {
            lineEl._lastWordIdx = currentWordIndex;
            for (let wIdx = 0; wIdx < wordSpans.length; wIdx++) {
              const wSpan = wordSpans[wIdx];
              const isP = wSpan.classList.contains('lyric-paren') ? ' lyric-paren' : '';
              const isKw = wSpan.classList.contains('lyric-keyword');
              const isWordActive = (wIdx === currentWordIndex);
              const isKwActive = (isKw && isWordActive) ? ' keyword-active' : '';
              const kwCls = isKw ? ' lyric-keyword' : '';
              const nextCls = (wIdx < currentWordIndex ? 'lyric-word past-word' : (isWordActive ? 'lyric-word active-word' : 'lyric-word')) + isP + kwCls + isKwActive;
              if (wSpan.className !== nextCls) wSpan.className = nextCls;
            }
          }
        }
      }
    };

    if (!lineChanged) {
      if (activeIndex >= 0) {
        updateActiveLineWords(document.getElementById(`lyric-line-${activeIndex}`), activeIndex);
      }
    } else {
      const prevActiveIdx = state.lastActiveLyricIdx;
      const isSequential = (prevActiveIdx >= 0 && activeIndex === prevActiveIdx + 1 && !shouldSnap && !state.forceLyricsScroll);

      if (isSequential) {
        const prevEl = document.getElementById(`lyric-line-${prevActiveIdx}`);
        if (prevEl) {
          prevEl.classList.remove('active');
          if (prevEl._kwEl) {
            prevEl._kwEl.classList.remove('keyword-active');
          } else {
            const prevKw = prevEl.querySelector('.lyric-keyword.keyword-active');
            if (prevKw) prevKw.classList.remove('keyword-active');
          }
          if (prevEl.classList.contains('gradient-line')) {
            prevEl.querySelectorAll('.lyric-fill').forEach(f => f.style.setProperty('--k', '0'));
          }
          if (state.syncedLyrics[prevActiveIdx]?.isGap) {
            prevEl.classList.add('past-gap');
          }
          if (!isGradientMode() && getAdv('karaoke_words', true) && state.lyricsMode === 'word') {
            (prevEl._wordSpans || prevEl.querySelectorAll('.lyric-word')).forEach(wSpan => {
              const isP = wSpan.classList.contains('lyric-paren') ? ' lyric-paren' : '';
              const isKw = wSpan.classList.contains('lyric-keyword') ? ' lyric-keyword' : '';
              wSpan.className = 'lyric-word past-word' + isP + isKw;
            });
          }
        }
        if (activeIndex >= 0) {
          const activeLineEl = document.getElementById(`lyric-line-${activeIndex}`);
          if (activeLineEl) {
            if (!activeLineEl.classList.contains('active')) activeLineEl.classList.add('active');
            updateActiveLineWords(activeLineEl, activeIndex);
          }
          cachedActiveGapEl = (state.syncedLyrics[activeIndex]?.isGap) ? activeLineEl : null;
        } else {
          cachedActiveGapEl = null;
        }
      } else {
        document.querySelectorAll('.lyric-line').forEach((lineEl, idx) => {
          const line = state.syncedLyrics[idx];
          if (line && line.isGap) {
            lineEl.classList.toggle('past-gap', idx < activeIndex);
          }
          if (idx === activeIndex) {
            if (!lineEl.classList.contains('active')) lineEl.classList.add('active');
            updateActiveLineWords(lineEl, idx);
          } else {
            if (lineEl.classList.contains('active')) lineEl.classList.remove('active');
            if (lineEl._kwEl) {
              lineEl._kwEl.classList.remove('keyword-active');
            } else {
              const kw = lineEl.querySelector('.lyric-keyword.keyword-active');
              if (kw) kw.classList.remove('keyword-active');
            }
            if (lineEl.classList.contains('gradient-line')) {
              lineEl.querySelectorAll('.lyric-fill').forEach(f => f.style.setProperty('--k', '0'));
            }
            if (!isGradientMode() && getAdv('karaoke_words', true) && state.lyricsMode === 'word') {
              const targetClsBase = idx < activeIndex ? 'lyric-word past-word' : 'lyric-word';
              (lineEl._wordSpans || lineEl.querySelectorAll('.lyric-word')).forEach(wSpan => {
                const isP = wSpan.classList.contains('lyric-paren') ? ' lyric-paren' : '';
                const isKw = wSpan.classList.contains('lyric-keyword') ? ' lyric-keyword' : '';
                const nextCls = targetClsBase + isP + isKw;
                if (wSpan.className !== nextCls) wSpan.className = nextCls;
              });
            }
          }
        });
        cachedActiveGapEl = (activeIndex >= 0 && state.syncedLyrics[activeIndex]?.isGap)
          ? document.getElementById(`lyric-line-${activeIndex}`) : null;
      }
    }

    if (cachedActiveGapEl && state.syncedLyrics && activeIndex >= 0) {
      updateActiveGapProgress(cachedActiveGapEl, matchTime);
    }
  }

  function updateLyricsModeButton() {
    if (!el.btnLyricsMode) return;
    const isWordEnabled = getAdv('karaoke_words', true);
    if (!isWordEnabled && state.lyricsMode === 'word') {
      state.lyricsMode = 'line';
    }
    const lblEl = el.btnLyricsMode.querySelector('span');
    tSet(lblEl, state.lyricsMode === 'word' ? 'Word' : 'Line');
  }

  if (el.btnLyricsMode) {
    updateLyricsModeButton();
    el.btnLyricsMode.addEventListener('click', () => {
      if (!getAdv('karaoke_words', true)) {
        state.lyricsMode = 'line';
        updateLyricsModeButton();
        return;
      }
      state.lyricsMode = state.lyricsMode === 'line' ? 'word' : 'line';
      updateLyricsModeButton();
      renderLyricsView();
      if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
    });
  }

  if (el.btnTranslateLyrics) {
    el.btnTranslateLyrics.addEventListener('click', () => {
      state.trActive = !state.trActive;
      updateLyricsTranslationUI();
      if (state.trActive) {
        fetchAndApplyTranslation();
      } else {
        state.currentTranslations = null;
        renderLyricsView();
        if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
      }
      if (typeof layoutLyricsCascade === 'function') layoutLyricsCascade(state.lastActiveLyricIdx, true);
    });
  }

  var lyricsContainerParent = null;
  var lyricsContainerSibling = null;
  var tvIdleTimer = null;


  function resetTvIdleTimer() {
    if (!state.isTvKaraokeOpen || !el.tvKaraoke) return;
    el.tvKaraoke.classList.remove('tv-idle');
    clearTimeout(tvIdleTimer);
    tvIdleTimer = setTimeout(() => {
      const tvkPanel = document.getElementById('tvk-panel');
      if (tvkPanel && tvkPanel.classList.contains('open')) return;
      if (state.isTvKaraokeOpen && el.tvKaraoke) {
        el.tvKaraoke.classList.add('tv-idle');
      }
    }, 1200);
  }

  var activeTvBannerKey = '';
  var activeTvLayerIdx = 0;
  var tvBannerTransitionTimer = null;

  function syncTvBanner() {
    const tvBg = el.tvBg || document.getElementById('tv-bg');
    if (!tvBg) return;

    let layerA = document.getElementById('tv-bg-layer-a');
    let layerB = document.getElementById('tv-bg-layer-b');
    if (!layerA || !layerB) {
      tvBg.innerHTML = '<div class="tv-bg-layer active" id="tv-bg-layer-a"></div><div class="tv-bg-layer" id="tv-bg-layer-b"></div>';
      layerA = document.getElementById('tv-bg-layer-a');
      layerB = document.getElementById('tv-bg-layer-b');
      activeTvLayerIdx = 0;
      activeTvBannerKey = '';
    }

    const banner = document.getElementById('right-panel-banner');
    let bannerType = 'none';
    let bannerSrc = '';

    if (banner && banner.style.display !== 'none' && banner.style.opacity !== '0') {
      const bannerImg = banner.querySelector('.banner-image');
      const video = banner.querySelector('video');
      const img = banner.querySelector('img');
      if (video && video.src) {
        bannerType = 'video';
        bannerSrc = video.src;
      } else if (img && img.src) {
        bannerType = 'img';
        bannerSrc = img.src;
      } else if (bannerImg && bannerImg.style.backgroundImage && bannerImg.style.backgroundImage !== 'none') {
        bannerType = 'bg';
        bannerSrc = bannerImg.style.backgroundImage;
      } else if (banner.style.backgroundImage && banner.style.backgroundImage !== 'none') {
        bannerType = 'bg';
        bannerSrc = banner.style.backgroundImage;
      }
    }

    if (bannerType === 'none') {
      const thumb = getTrackThumbUrl(state.currentTrack);
      if (thumb) {
        bannerType = 'fallback';
        bannerSrc = thumb;
      }
    }

    const newKey = `${bannerType}:${bannerSrc}`;
    if (newKey === activeTvBannerKey) return;

    const layers = [layerA, layerB];
    const prevLayer = layers[activeTvLayerIdx];
    const nextIdx = 1 - activeTvLayerIdx;
    const nextLayer = layers[nextIdx];

    if (tvBannerTransitionTimer) {
      clearTimeout(tvBannerTransitionTimer);
      tvBannerTransitionTimer = null;
    }

    nextLayer.innerHTML = '';
    nextLayer.style.backgroundImage = '';
    nextLayer.classList.remove('fallback');

    let transitionDone = false;
    const activateNext = () => {
      if (transitionDone) return;
      transitionDone = true;
      nextLayer.classList.add('active');
      prevLayer.classList.remove('active');
      activeTvLayerIdx = nextIdx;
      activeTvBannerKey = newKey;

      tvBannerTransitionTimer = setTimeout(() => {
        prevLayer.innerHTML = '';
        prevLayer.style.backgroundImage = '';
        prevLayer.classList.remove('fallback');
        tvBannerTransitionTimer = null;
      }, 550);
    };

    if (bannerType === 'video') {
      const vid = document.createElement('video');
      vid.autoplay = true;
      vid.loop = true;
      vid.muted = true;
      vid.playsInline = true;
      vid.src = bannerSrc;
      vid.onloadeddata = () => {
        vid.play().catch(() => {});
        activateNext();
      };
      vid.onerror = () => activateNext();
      nextLayer.appendChild(vid);
    } else if (bannerType === 'img') {
      const img = document.createElement('img');
      img.onload = () => activateNext();
      img.onerror = () => activateNext();
      img.src = bannerSrc;
      nextLayer.appendChild(img);
    } else if (bannerType === 'bg') {
      nextLayer.style.backgroundImage = bannerSrc;
      activateNext();
    } else if (bannerType === 'fallback') {
      nextLayer.classList.add('fallback');
      const img = new Image();
      img.onload = () => {
        nextLayer.style.backgroundImage = `url("${bannerSrc}")`;
        activateNext();
      };
      img.onerror = () => {
        nextLayer.style.backgroundImage = `url("${bannerSrc}")`;
        activateNext();
      };
      img.src = bannerSrc;
    } else {
      activateNext();
    }
  }

  function syncTvLayout(forcedNoLyrics) {
    const tv = el.tvKaraoke || document.getElementById('tv-karaoke');
    if (!tv) return;
    const noLyrics = typeof forcedNoLyrics === 'boolean'
      ? forcedNoLyrics
      : (state.isLoadingLyrics ? tv.classList.contains('tv-nolyrics') : (!state.syncedLyrics || state.syncedLyrics.length === 0));
    const wasNoLyrics = tv.classList.contains('tv-nolyrics');
    tv.classList.toggle('tv-nolyrics', !!noLyrics);
    if (wasNoLyrics !== !!noLyrics && typeof resizeCanvases === 'function') {
      requestAnimationFrame(resizeCanvases);
    }
    if (typeof updateTvkTitleMarquee === 'function') {
      requestAnimationFrame(updateTvkTitleMarquee);
    }
  }

  var activeTvkAmbientCover = '';
  var activeTvkBlurVal = -1;
  var tvkPaletteCache = new Map();
  var tvkBakedCoverCache = new Map();

  [tvkPaletteCache].forEach(m => {
    const origSet = m.set.bind(m);
    m.set = function(k, v) {
      const res = origSet(k, v);
      boundMap(m, 30);
      return res;
    };
  });

  function extract10CoverColors(imgSrc) {
    const defaultMono = [
      [22, 22, 26], [34, 34, 40], [48, 48, 56], [28, 28, 34], [42, 42, 50],
      [18, 18, 22], [58, 58, 68], [30, 30, 36], [40, 40, 46], [25, 25, 30]
    ];
    if (!imgSrc) return Promise.resolve(defaultMono);
    if (tvkPaletteCache.has(imgSrc)) return Promise.resolve(tvkPaletteCache.get(imgSrc));

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = 40;
          c.height = 40;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, 40, 40);
          const data = ctx.getImageData(0, 0, 40, 40).data;

          const colorful = [];
          for (let i = 0; i < data.length; i += 8) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const hsl = rgbToHsl(r, g, b);
            if (hsl.l >= 12 && hsl.l <= 88 && hsl.s >= 18) {
              const weight = (hsl.s / 100) * (1 - Math.abs(hsl.l - 50) / 55);
              colorful.push({ r, g, b, h: hsl.h, s: hsl.s, l: hsl.l, weight });
            }
          }

          if (colorful.length < 12) {
            const monoPicked = [];
            for (let k = 0; k < 10; k++) {
              const v = 18 + Math.round((k / 9) * 52);
              monoPicked.push([v, v, Math.min(255, v + 3)]);
            }
            tvkPaletteCache.set(imgSrc, monoPicked);
            return resolve(monoPicked);
          }

          colorful.sort((a, b) => b.weight - a.weight);
          const pickedHsl = [];
          let minHueDiff = 22;
          while (pickedHsl.length < 6 && minHueDiff >= 4) {
            for (const p of colorful) {
              if (pickedHsl.length >= 6) break;
              const close = pickedHsl.some(ex => {
                const d = Math.abs(ex.h - p.h);
                return Math.min(d, 360 - d) < minHueDiff && Math.abs(ex.l - p.l) < 15;
              });
              if (!close) pickedHsl.push(p);
            }
            minHueDiff -= 6;
          }

          const finalRgb = [];
          for (let i = 0; i < 10; i++) {
            const base = pickedHsl[i % pickedHsl.length];
            const targetS = Math.max(35, Math.min(88, base.s));
            const lShift = (i >= pickedHsl.length) ? ((i % 2 === 0) ? 10 : -10) : 0;
            const targetL = Math.max(22, Math.min(56, base.l + lShift));
            const hex = hslToHex(base.h, targetS, targetL);
            const rgb = hexToRgb(hex);
            finalRgb.push([rgb.r, rgb.g, rgb.b]);
          }

          if (tvkPaletteCache.size >= 80) tvkPaletteCache.delete(tvkPaletteCache.keys().next().value);
          tvkPaletteCache.set(imgSrc, finalRgb);
          resolve(finalRgb);
        } catch (_) {
          resolve(defaultMono);
        }
      };
      img.onerror = () => resolve(defaultMono);
      img.src = imgSrc;
    });
  }

  function paintTvkLayerCanvas(canvas, colors, seedOffset = 0) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const c0 = colors[0] || [28, 28, 32];
    const c1 = colors[1] || c0;
    const c2 = colors[2] || c0;

    const baseGrad = ctx.createLinearGradient(0, 0, w, h);
    baseGrad.addColorStop(0, `rgb(${c0[0]}, ${c0[1]}, ${c0[2]})`);
    baseGrad.addColorStop(0.5, `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`);
    baseGrad.addColorStop(1, `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`);
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    const positions = [
      [0.12, 0.18], [0.85, 0.15], [0.22, 0.82], [0.82, 0.78], [0.48, 0.32],
      [0.55, 0.68], [0.18, 0.48], [0.88, 0.46], [0.36, 0.14], [0.66, 0.88]
    ];
    for (let i = 0; i < 10; i++) {
      const pos = positions[(i + seedOffset) % positions.length];
      const cx = pos[0] * w;
      const cy = pos[1] * h;
      const rad = (0.48 + (i % 3) * 0.12) * Math.max(w, h);
      const col = colors[(i + seedOffset) % colors.length] || c0;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.92)`);
      g.addColorStop(0.45, `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.48)`);
      g.addColorStop(1, `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(0, 0, w, h);
  }

  function buildBakedTvkBlobUrl(img, cropX, cropY, cropW, cropH, blurPx, sat, bright) {
    const size = 192;
    const pad = Math.ceil(blurPx * 1.8);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.filter = `blur(${Math.max(1, blurPx)}px) saturate(${sat}) contrast(1.18) brightness(${bright})`;
    ctx.drawImage(img, cropX, cropY, cropW, cropH, -pad, -pad, size + pad * 2, size + pad * 2);
    return c.toDataURL('image/jpeg', 0.86);
  }

  var tvkBaseColorCache = new Map();

  function getCoverBaseColor(url) {
    if (!url) return Promise.resolve({ rgb: 'rgb(10, 10, 14)', r: 10, g: 10, b: 14, lum: 0.04 });
    if (tvkBaseColorCache.has(url)) {
      return Promise.resolve(tvkBaseColorCache.get(url));
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      const fallback = { rgb: 'rgb(10, 10, 14)', r: 10, g: 10, b: 14, lum: 0.04 };
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 32, 32);
          const data = ctx.getImageData(0, 0, 32, 32).data;
          const buckets = new Map();
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const qr = r >> 4;
            const qg = g >> 4;
            const qb = b >> 4;
            const key = (qr << 8) | (qg << 4) | qb;
            const entry = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
            entry.count++;
            entry.r += r;
            entry.g += g;
            entry.b += b;
            buckets.set(key, entry);
          }
          let best = null;
          for (const entry of buckets.values()) {
            if (!best || entry.count > best.count) {
              best = entry;
            }
          }
          if (best && best.count > 0) {
            const r = Math.round(best.r / best.count);
            const g = Math.round(best.g / best.count);
            const b = Math.round(best.b / best.count);
            const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
            const res = { rgb: `rgb(${r}, ${g}, ${b})`, r, g, b, lum };
            tvkBaseColorCache.set(url, res);
            boundMap(tvkBaseColorCache, 30);
            resolve(res);
          } else {
            resolve(fallback);
          }
        } catch (_) {
          resolve(fallback);
        }
      };
      img.onerror = () => {
        if (img.crossOrigin) {
          img.crossOrigin = null;
          img.src = url;
          return;
        }
        resolve(fallback);
      };
      img.src = url;
    });
  }

  function syncTvkAmbientBg(force = false) {
    if (!state.isTvKaraokeOpen) return;
    const container = document.getElementById('tvk-ambient-bg');
    if (!container) return;
    if (!container.querySelector('.tvk-ambient-blob.b5')) {
      container.innerHTML = '<div class="tvk-ambient-blob b1"></div><div class="tvk-ambient-blob b2"></div><div class="tvk-ambient-blob b3"></div><div class="tvk-ambient-blob b4"></div><div class="tvk-ambient-blob b5"></div>';
    }
    const curTrack = state.currentTrack;
    const thumb = curTrack ? getTrackThumbUrl(curTrack) : '';
    const tv = el.tvKaraoke || document.getElementById('tv-karaoke');

    if (!thumb) {
      activeTvkAmbientCover = '';
      container.dataset.painted = '1';
      const blobs = container.querySelectorAll('.tvk-ambient-blob');
      blobs.forEach(b => { b.style.backgroundImage = 'none'; });
      if (tv) {
        tv.classList.remove('tvk-bright-bg');
        state.tvkFg = '#ffffff';
        tv.style.setProperty('--tvk-base', '#000000');
        tv.style.setProperty('--tvk-fg', '#ffffff');
        tv.style.setProperty('--tvk-vignette-opacity', '1');
      }
      return;
    }

    if (!force && thumb === activeTvkAmbientCover && container.dataset.painted === '1' && tv && tv.style.getPropertyValue('--tvk-base')) return;
    activeTvkAmbientCover = thumb;
    container.dataset.painted = '1';
    const blobs = container.querySelectorAll('.tvk-ambient-blob');
    const cssUrl = `url(${JSON.stringify(thumb)})`;
    blobs.forEach(b => { b.style.backgroundImage = cssUrl; });

    if (tv) {
      state.tvkFg = '#ffffff';
      tv.style.setProperty('--tvk-base', '#000000');
      tv.style.setProperty('--tvk-fg', '#ffffff');
      tv.style.setProperty('--tvk-vignette-opacity', '1');
      analyzeCover(thumb).then(res => {
        if (thumb !== activeTvkAmbientCover) return;
        tv.classList.toggle('tvk-bright-bg', Boolean(res && res.luminance > 0.44));
      }).catch(() => {});
    }
  }

  function syncTvkAmbientPlayback() {
    const tv = el.tvKaraoke || document.getElementById('tv-karaoke');
    if (!tv) return;
    const paused = !state.isTvKaraokeOpen || tv.classList.contains('hidden') || tv.classList.contains('closing') || document.hidden || document.body.classList.contains('perf');
    tv.classList.toggle('tvk-bg-paused', paused);
  }
  document.addEventListener('visibilitychange', syncTvkAmbientPlayback);

  function getTvkLyricsStatusText() {
    const lang = localStorage.getItem('riff_ui_lang') || 'en';
    const isRu = lang === 'ru';
    if (state.isLoadingLyrics || !state.lyricsLoaded) {
      return '';
    }
    if (!state.syncedLyrics || state.syncedLyrics.length === 0 || state.syncedLyrics.every(l => !l.text || l.isGap)) {
      return isRu ? 'Нет текста' : (typeof t === 'function' ? t('No lyrics') : 'No lyrics');
    }
    const hasSync = state.syncedLyrics.some(p => p.time >= 0);
    if (!hasSync) {
      return isRu ? 'Нет таймингов для текста' : (typeof t === 'function' ? t('No timing for lyrics') : 'No timing for lyrics');
    }
    return '';
  }

  function updateTvkLyricsStatus() {
    let stEl = document.getElementById('tv-karaoke-lyrics-status');
    if (!stEl) {
      const metaContainer = document.getElementById('tv-karaoke-meta');
      const artistRow = document.getElementById('tv-karaoke-artist-row');
      if (metaContainer || (artistRow && artistRow.parentNode)) {
        stEl = document.createElement('div');
        stEl.id = 'tv-karaoke-lyrics-status';
        stEl.className = 'tv-karaoke-lyrics-status';
        if (metaContainer) {
          metaContainer.appendChild(stEl);
        } else if (artistRow && artistRow.parentNode) {
          artistRow.parentNode.appendChild(stEl);
        }
      }
    }
    if (stEl) {
      const txt = getTvkLyricsStatusText();
      stEl.textContent = txt;
      stEl.style.display = txt ? '' : 'none';
    }
  }
  window.updateTvkLyricsStatus = updateTvkLyricsStatus;

  function updateTvkTitleMarquee() {
    const titleEl = el.tvKaraokeTitle || document.getElementById('tv-karaoke-title');
    if (!titleEl) return;
    let inner = titleEl.querySelector('.tvk-title-inner');
    if (!inner) {
      const txt = titleEl.textContent || '';
      titleEl.textContent = '';
      inner = document.createElement('span');
      inner.className = 'tvk-title-inner';
      inner.textContent = txt;
      titleEl.appendChild(inner);
    }
    titleEl.classList.remove('is-marquee');
    titleEl.style.removeProperty('--tvk-marquee-dist');
    titleEl.style.removeProperty('--tvk-marquee-dur');
    const boxW = titleEl.clientWidth;
    const textW = inner.scrollWidth;
    if (boxW > 20 && textW > boxW + 2) {
      const dist = Math.ceil(textW - boxW + 20);
      const dur = Math.max(7, Math.min(22, 6 + dist / 22));
      titleEl.style.setProperty('--tvk-marquee-dist', '-' + dist + 'px');
      titleEl.style.setProperty('--tvk-marquee-dur', dur.toFixed(1) + 's');
      titleEl.classList.add('is-marquee');
    }
  }
  window.updateTvkTitleMarquee = updateTvkTitleMarquee;

  var lastTvMetaTrackKey = '';
  function updateTvKaraokeMeta() {
    const curTrack = state.currentTrack;
    const isExp = typeof isTrackExplicit === 'function' && isTrackExplicit(curTrack);
    const trackKey = curTrack ? `${curTrack.id || ''}:${curTrack.title || ''}:${curTrack.artist || ''}:${isExp ? '1' : '0'}` : '';
    const isNew = trackKey !== lastTvMetaTrackKey;
    lastTvMetaTrackKey = trackKey;

    const titleText = (curTrack && curTrack.title) || 'No track';
    const artistText = (curTrack && curTrack.artist) || '';

    const setTitleDom = () => {
      if (!el.tvKaraokeTitle) return;
      el.tvKaraokeTitle.innerHTML = `<span class="tvk-title-inner">${escapeHtml(titleText)}</span>`;
      requestAnimationFrame(updateTvkTitleMarquee);
    };

    if (el.tvKaraokeTitle) {
      if (isNew && el.tvKaraokeTitle.textContent !== titleText) {
        el.tvKaraokeTitle.style.opacity = '0';
        el.tvKaraokeTitle.style.transform = 'translateY(6px)';
        setTimeout(() => {
          setTitleDom();
          el.tvKaraokeTitle.style.opacity = '1';
          el.tvKaraokeTitle.style.transform = 'none';
        }, 120);
      } else {
        setTitleDom();
      }
    }
    if (el.tvKaraokeArtist) {
      const renderArtist = () => {
        renderClickableArtists(el.tvKaraokeArtist, artistText);
        if (isExp) {
          const badge = document.createElement('span');
          badge.className = 'explicit-badge';
          badge.title = 'Explicit';
          badge.textContent = 'E';
          el.tvKaraokeArtist.prepend(badge);
        }
        let artistRow = document.getElementById('tv-karaoke-artist-row');
        if (!artistRow && el.tvKaraokeArtist && el.tvKaraokeArtist.parentNode) {
          artistRow = document.createElement('div');
          artistRow.id = 'tv-karaoke-artist-row';
          artistRow.className = 'tv-karaoke-artist-row';
          el.tvKaraokeArtist.parentNode.insertBefore(artistRow, el.tvKaraokeArtist);
          artistRow.appendChild(el.tvKaraokeArtist);
        }
        const tvkMain = document.getElementById('tv-karaoke');
        const controls = document.getElementById('tvk-controls');
        if (controls && tvkMain && controls.parentNode === artistRow) {
          tvkMain.appendChild(controls);
        }
        updateTvkLyricsStatus();
        requestAnimationFrame(() => {
          if (el.tvKaraokeArtist) {
            const isOverflow = el.tvKaraokeArtist.scrollWidth > el.tvKaraokeArtist.clientWidth + 1;
            el.tvKaraokeArtist.classList.toggle('is-overflowing', isOverflow);
          }
        });
      };

      if (isNew) {
        el.tvKaraokeArtist.style.opacity = '0';
        el.tvKaraokeArtist.style.transform = 'translateY(6px)';
        setTimeout(() => {
          renderArtist();
          el.tvKaraokeArtist.style.opacity = '1';
          el.tvKaraokeArtist.style.transform = 'none';
        }, 120);
      } else {
        renderArtist();
      }
    }

    const coverEl = el.tvCover || document.getElementById('tv-cover');
    if (coverEl) {
      if (typeof bindCoverHoldZoom === 'function') bindCoverHoldZoom(coverEl);
      const thumb = getTrackThumbUrl(curTrack);
      if (thumb) {
        if (coverEl.dataset.currentThumb !== thumb) {
          coverEl.dataset.currentThumb = thumb;
          const preImg = new Image();
          preImg.onload = () => {
            if (coverEl.dataset.currentThumb === thumb) {
              coverEl.style.opacity = '0';
              coverEl.style.transform = 'scale(0.96)';
              setTimeout(() => {
                coverEl.src = thumb;
                coverEl.style.display = 'block';
                coverEl.style.opacity = '1';
                coverEl.style.transform = 'scale(1)';
              }, 120);
            }
          };
          preImg.onerror = () => {
            coverEl.src = thumb;
            coverEl.style.display = 'block';
            coverEl.style.opacity = '1';
            coverEl.style.transform = 'scale(1)';
          };
          preImg.src = thumb;
        }
      } else {
        coverEl.dataset.currentThumb = '';
        coverEl.style.display = 'none';
        coverEl.src = '';
      }
    }
    syncTvBanner();
    syncTvLayout();
    syncTvkAmbientBg();
  }

  var tvkOutputInterval = null;
  async function updateTvkOutput() {
    const nameEl = document.getElementById('tvk-output-name');
    const batteryEl = document.getElementById('tvk-battery');
    const batteryPctEl = document.getElementById('tvk-battery-pct');
    const batteryLevelEl = document.getElementById('tvk-battery-level');
    const outputContainer = document.getElementById('tvk-output');
    if (!nameEl) return;

    let deviceName = '';
    let batteryLevel = null;

    if (window.electronAPI && typeof window.electronAPI.getAudioOutputInfo === 'function') {
      try {
        const info = await window.electronAPI.getAudioOutputInfo();
        if (info && info.name && info.name !== 'Default output') {
          deviceName = info.name;
        }
        if (info && typeof info.battery === 'number') {
          batteryLevel = info.battery;
        }
      } catch (e) {}
    }

    if (!deviceName) {
      try {
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/audio-output-info`);
        if (res.ok) {
          const info = await res.json();
          if (info && info.name && info.name !== 'Default output') {
            deviceName = info.name;
          }
          if (info && typeof info.battery === 'number') {
            batteryLevel = info.battery;
          }
        }
      } catch (e) {}
    }

    if (!deviceName && !window.electronAPI?.getAudioOutputInfo && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        const audioEl = el.nativeAudio || document.getElementById('native-audio');
        const sinkId = (audioEl && audioEl.sinkId) ? audioEl.sinkId : '';

        let matched = null;
        if (sinkId) {
          matched = audioOutputs.find(d => d.deviceId === sinkId);
        }
        if (!matched) {
          matched = audioOutputs.find(d => d.deviceId === 'default') || audioOutputs[0];
        }

        let label = matched && matched.label ? matched.label.trim() : '';
        label = label.replace(/^Default\s*[-–—:]\s*/i, '').trim();
        if (label && label.toLowerCase() !== 'default') {
          deviceName = label;
        }
      } catch (e) {}
    }

    const finalName = t(deviceName || 'Default output');
    nameEl.textContent = finalName;
    if (outputContainer) outputContainer.title = finalName;

    if (batteryEl && batteryPctEl && batteryLevelEl) {
      if (batteryLevel !== null && !isNaN(batteryLevel) && batteryLevel >= 0) {
        const clampedPct = Math.max(0, Math.min(100, Math.round(batteryLevel)));
        batteryPctEl.textContent = `${clampedPct}%`;
        const fillH = Math.max(clampedPct > 0 ? 1 : 0, Math.min(12, Math.round(12 * (clampedPct / 100))));
        const fillY = 19 - fillH;
        batteryLevelEl.setAttribute('y', fillY);
        batteryLevelEl.setAttribute('height', fillH);
        batteryLevelEl.setAttribute('x', '8');
        batteryLevelEl.setAttribute('width', '8');
        batteryEl.classList.remove('hidden');
        batteryEl.classList.toggle('battery-low', clampedPct <= 20);
        batteryEl.title = `Battery level: ${clampedPct}%`;
      } else {
        batteryEl.classList.add('hidden');
      }
    }
  }

  function openTvKaraoke() {
    if (!el.tvKaraoke || !el.lyricsContainer) return;
    if (state.isTvKaraokeOpen) return;
    state.isTvKaraokeOpen = true;
    const btnPlaybarKaraoke = el.btnPlaybarKaraoke || document.getElementById('btn-playbar-karaoke');
    if (btnPlaybarKaraoke) btnPlaybarKaraoke.classList.toggle('active', state.isTvKaraokeOpen);

    lyricsContainerParent = el.lyricsContainer.parentElement;
    lyricsContainerSibling = el.lyricsContainer.nextSibling;

    if (el.tvKaraokeContent) {
      el.tvKaraokeContent.appendChild(el.lyricsContainer);
    }
    if (el.lyricsContainer) {
      el.lyricsContainer.style.paddingTop = '';
      el.lyricsContainer.style.paddingBottom = '';
      el.lyricsContainer.scrollTop = 0;
    }
    updateTvKaraokeMeta();
    syncTvBanner();
    syncTvLayout();
    syncTvkAmbientBg();
    el.tvKaraoke.classList.remove('closing');
    el.tvKaraoke.classList.remove('hidden');
    syncTvkAmbientPlayback();
    applyTvk();
    syncTvkUI();
    resetTvIdleTimer();
    resizeCanvases();
    if (typeof updateTopMomentPin === 'function') updateTopMomentPin();
    requestAnimationFrame(() => {
      resizeCanvases();
      if (typeof updateTopMomentPin === 'function') updateTopMomentPin();
    });
    if (state.isPlaying) {
      if (audioEngine && audioEngine.setAnalyserEnabled) audioEngine.setAnalyserEnabled(true);
      startVisualizers();
    }

    cancelAnimationFrame(lyricsScrollRaf);
    renderLyricsView();
    const syncTvLyrics = () => {
      updateLyricsPadding();
      state.forceSnapLyrics = true;
      state.forceLyricsScroll = true;
      state.lastActiveLyricIdx = -1;
      if (el.nativeAudio) {
        const cur = el.nativeAudio.currentTime || 0;
        const dur = el.nativeAudio.duration || (state.currentTrack ? state.currentTrack.duration : 0);
        updateSyncedLyricsHighlight(cur);
        if (el.tvkTimeCurrent) el.tvkTimeCurrent.textContent = formatDuration(cur);
        if (el.tvkTimeDuration) el.tvkTimeDuration.textContent = formatDuration(dur);
        if (el.tvkSeekSlider && dur > 0) el.tvkSeekSlider.value = Math.round((cur / dur) * 1000);
      }
    };
    requestAnimationFrame(syncTvLyrics);
    const isTvPlaying = !!(state.isPlaying && el.nativeAudio && !el.nativeAudio.paused);
    updatePlayPauseButton(isTvPlaying, state.isBuffering);
    setPlayPauseState(isTvPlaying, false);
    updateTvkOutput();
    if (tvkOutputInterval) clearInterval(tvkOutputInterval);
    tvkOutputInterval = setInterval(updateTvkOutput, 30000);
  }

  function closeTvKaraoke() {
    if (!state.isTvKaraokeOpen || !el.tvKaraoke) return;
    state.isTvKaraokeOpen = false;
    const btnPlaybarKaraoke = el.btnPlaybarKaraoke || document.getElementById('btn-playbar-karaoke');
    if (btnPlaybarKaraoke) btnPlaybarKaraoke.classList.toggle('active', state.isTvKaraokeOpen);
    syncTvkAmbientPlayback();
    clearTimeout(tvIdleTimer);
    if (tvkOutputInterval) {
      clearInterval(tvkOutputInterval);
      tvkOutputInterval = null;
    }
    const tvkPanel = document.getElementById('tvk-panel');
    if (tvkPanel) {
      tvkPanel.classList.remove('open');
      const btnSettings = document.getElementById('btn-tvk-settings');
      if (btnSettings) btnSettings.classList.remove('open');
    }
    el.tvKaraoke.classList.remove('tv-idle');
    el.tvKaraoke.classList.add('closing');
    setTimeout(() => {
      el.tvKaraoke.classList.remove('closing');
      el.tvKaraoke.classList.add('hidden');
      syncTvkAmbientPlayback();
    }, 320);

    const targetParent = (lyricsContainerParent && lyricsContainerParent.isConnected)
      ? lyricsContainerParent
      : (document.querySelector('.lyrics-section') || (el.rightPanel && el.rightPanel.querySelector('.lyrics-section')));
    if (targetParent && el.lyricsContainer) {
      if (lyricsContainerSibling && lyricsContainerSibling.parentNode === targetParent) {
        targetParent.insertBefore(el.lyricsContainer, lyricsContainerSibling);
      } else {
        targetParent.appendChild(el.lyricsContainer);
      }
    }
    if (el.lyricsContainer) {
      el.lyricsContainer.style.paddingTop = '';
      el.lyricsContainer.style.paddingBottom = '';
      el.lyricsContainer.scrollTop = 0;
    }

    cancelAnimationFrame(lyricsScrollRaf);
    renderLyricsView();
    const syncSidebarLyrics = () => {
      updateLyricsPadding();
      state.forceSnapLyrics = true;
      state.forceLyricsScroll = true;
      state.lastActiveLyricIdx = -1;
      if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
    };
    syncSidebarLyrics();
    requestAnimationFrame(syncSidebarLyrics);
    setTimeout(syncSidebarLyrics, 50);
    setTimeout(syncSidebarLyrics, 150);
    setTimeout(syncSidebarLyrics, 300);
  }

  window.openTvKaraoke = openTvKaraoke;
  window.closeTvKaraoke = closeTvKaraoke;

  if (el.btnTvKaraoke) {
    el.btnTvKaraoke.addEventListener('click', openTvKaraoke);
  }
  if (el.tvKaraokeClose) {
    el.tvKaraokeClose.addEventListener('click', closeTvKaraoke);
  }
  var btnPlaybarKaraoke = el.btnPlaybarKaraoke || document.getElementById('btn-playbar-karaoke');
  if (btnPlaybarKaraoke) {
    btnPlaybarKaraoke.addEventListener('click', () => {
      if (state.isTvKaraokeOpen) {
        closeTvKaraoke();
      } else {
        openTvKaraoke();
      }
    });
  }
  if (el.tvKaraoke) {
    el.tvKaraoke.addEventListener('mousemove', resetTvIdleTimer);
  }

  var btnTvkCoverMode = document.getElementById('btn-tvk-cover-mode');
  if (btnTvkCoverMode && el.tvKaraoke) {
    const applyCoverMode = () => {
      const on = localStorage.getItem('riff_tvk_cover_mode') === '1';
      el.tvKaraoke.classList.toggle('tv-cover-mode', on);
      btnTvkCoverMode.classList.toggle('active', on);
    };
    applyCoverMode();
    btnTvkCoverMode.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = localStorage.getItem('riff_tvk_cover_mode') !== '1';
      localStorage.setItem('riff_tvk_cover_mode', on ? '1' : '0');
      applyCoverMode();
      resetTvIdleTimer();
    });
  }

  var btnTvkShuffle = document.getElementById('btn-tvk-shuffle');
  var btnTvkPrev = document.getElementById('btn-tvk-prev');
  var btnTvkPlay = document.getElementById('btn-tvk-play');
  var btnTvkNext = document.getElementById('btn-tvk-next');
  var btnTvkRepeat = document.getElementById('btn-tvk-repeat');

  if (btnTvkShuffle && el.btnShuffle) {
    btnTvkShuffle.addEventListener('click', () => el.btnShuffle.click());
    btnTvkShuffle.classList.toggle('active', el.btnShuffle.classList.contains('active'));
    const obsShuffle = new MutationObserver(() => {
      btnTvkShuffle.classList.toggle('active', el.btnShuffle.classList.contains('active'));
    });
    obsShuffle.observe(el.btnShuffle, { attributes: true, attributeFilter: ['class'] });
  }

  function setupSeekOrSkipButton(button, onSkip, deltaSec) {
    if (!button) return;
    let holdTimer = null;
    let seekInterval = null;
    let isHold = false;

    const doSeek = () => {
      if (el.nativeAudio && Number.isFinite(el.nativeAudio.duration) && el.nativeAudio.duration > 0) {
        if (deltaSec > 0) {
          el.nativeAudio.currentTime = Math.min(el.nativeAudio.duration, el.nativeAudio.currentTime + deltaSec);
        } else {
          el.nativeAudio.currentTime = Math.max(0, el.nativeAudio.currentTime + deltaSec);
        }
        if (typeof updateMediaPositionState === 'function') updateMediaPositionState();
      }
    };

    const stopHold = () => {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      if (seekInterval) { clearInterval(seekInterval); seekInterval = null; }
    };

    button.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      isHold = false;
      stopHold();
      holdTimer = setTimeout(() => {
        isHold = true;
        doSeek();
        seekInterval = setInterval(doSeek, 350);
      }, 350);
    });

    const onPointerEnd = () => stopHold();
    button.addEventListener('pointerup', onPointerEnd);
    button.addEventListener('pointercancel', onPointerEnd);
    button.addEventListener('pointerleave', onPointerEnd);

    button.addEventListener('click', (e) => {
      if (isHold) {
        e.preventDefault();
        e.stopImmediatePropagation();
        isHold = false;
        return;
      }
      onSkip();
    });
  }

  if (btnTvkPrev) setupSeekOrSkipButton(btnTvkPrev, playPrev, -5);
  if (btnTvkNext) setupSeekOrSkipButton(btnTvkNext, playNext, 5);
  if (btnTvkPlay) btnTvkPlay.addEventListener('click', () => togglePlayPause());

  if (btnTvkRepeat && el.btnRepeat) {
    btnTvkRepeat.addEventListener('click', () => el.btnRepeat.click());
    btnTvkRepeat.classList.toggle('active', el.btnRepeat.classList.contains('active'));
    const obsRepeat = new MutationObserver(() => {
      btnTvkRepeat.classList.toggle('active', el.btnRepeat.classList.contains('active'));
    });
    obsRepeat.observe(el.btnRepeat, { attributes: true, attributeFilter: ['class'] });
  }

  var tvkSeekSlider = el.tvkSeekSlider || document.getElementById('tvk-seek-slider');
  var tvkTimeCur = el.tvkTimeCurrent || document.getElementById('tvk-time-current');
  if (tvkSeekSlider) {
    const onTvkSeekInput = () => {
      const dur = getReliableTrackDuration();
      const frac = Math.max(0, Math.min(1, Number(tvkSeekSlider.value) / 1000));
      const targetTime = frac * dur;
      if (tvkTimeCur) tvkTimeCur.textContent = formatDuration(targetTime);
      if (el.timeCurrent) el.timeCurrent.textContent = formatDuration(targetTime);
      if (el.nativeAudio && Number.isFinite(targetTime) && dur > 0) {
        el.nativeAudio.currentTime = targetTime;
        updateMediaPositionState();
      }
    };
    tvkSeekSlider.addEventListener('pointerdown', () => { isDraggingTvkSeek = true; });
    tvkSeekSlider.addEventListener('input', onTvkSeekInput);
    const stopTvkSeek = () => { isDraggingTvkSeek = false; };
    tvkSeekSlider.addEventListener('pointerup', stopTvkSeek);
    tvkSeekSlider.addEventListener('change', stopTvkSeek);
  }

  if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
    navigator.mediaDevices.addEventListener('devicechange', () => {
      updateTvkOutput();
    });
  }

  var TVK_DEFAULTS = {
    font: 'Google Sans',
    align: 'center',
    size: 100,
    weight: 500,
    gap: 16,
    anim: 'slide',
    speed: 900,
    viscosity: 1450
  };

  var SF_FONT_STACK = window.SF_FONT_STACK || '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif';
  window.SF_FONT_STACK = SF_FONT_STACK;

  var TVK_FONTS = {
    'Google Sans': "'Google Sans', 'Google Sans Text', system-ui, -apple-system, sans-serif",
    'google-sans': "'Google Sans', 'Google Sans Text', system-ui, -apple-system, sans-serif",
    "'Google Sans', 'Google Sans Text', system-ui, -apple-system, sans-serif": "'Google Sans', 'Google Sans Text', system-ui, -apple-system, sans-serif",
    'SF Pro': SF_FONT_STACK,
    'sf': SF_FONT_STACK,
    [SF_FONT_STACK]: SF_FONT_STACK,
    'System': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'system': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'inherit': "'Google Sans', 'Google Sans Text', system-ui, -apple-system, sans-serif",
    'default': "'Google Sans', 'Google Sans Text', system-ui, -apple-system, sans-serif"
  };

  function getTvk() {
    try {
      const raw = localStorage.getItem('riff_tvk');
      if (raw) {
        const parsed = JSON.parse(raw);
        let font = parsed.font || 'Google Sans';
        if (font === 'sf' || font === SF_FONT_STACK || font === 'SF Pro') font = 'SF Pro';
        else if (font === 'system' || font === 'System') font = 'System';
        else font = 'Google Sans';

        return {
          font,
          align: ['left', 'center', 'right'].includes(parsed.align) ? parsed.align : TVK_DEFAULTS.align,
          size: Number(parsed.size) || TVK_DEFAULTS.size,
          weight: (parsed.weight !== undefined && !isNaN(Number(parsed.weight))) ? Number(parsed.weight) : TVK_DEFAULTS.weight,
          gap: (parsed.gap !== undefined && !isNaN(Number(parsed.gap))) ? Number(parsed.gap) : TVK_DEFAULTS.gap,
          anim: parsed.anim || TVK_DEFAULTS.anim,
          speed: Number(parsed.speed) || TVK_DEFAULTS.speed,
          viscosity: (parsed.viscosity !== undefined && !isNaN(Number(parsed.viscosity))) ? Number(parsed.viscosity) : TVK_DEFAULTS.viscosity
        };
      }
    } catch (_) {}
    return { ...TVK_DEFAULTS };
  }

  function saveTvk(settings) {
    try {
      localStorage.setItem('riff_tvk', JSON.stringify(settings));
    } catch (_) {}
  }

  function updateTvkVisualizerSetting(enabled) {
    const on = enabled !== false && enabled !== 'false';
    localStorage.setItem('riff_tvk_visualizer', on ? 'true' : 'false');
    const tv = document.getElementById('tv-karaoke');
    if (tv) {
      tv.classList.toggle('no-tvk-visualizer', !on);
    }
    const btnTvkVis = document.getElementById('btn-tvk-visualizer');
    if (btnTvkVis) btnTvkVis.classList.toggle('active', on);
    const btnTvkVisSetting = document.getElementById('btn-tvk-visualizer-setting');
    if (btnTvkVisSetting) btnTvkVisSetting.classList.toggle('active', on);
    if (on && state.isPlaying) {
      if (audioEngine && audioEngine.setAnalyserEnabled) audioEngine.setAnalyserEnabled(true);
      startVisualizers();
    }
  }

  function updateTvkVisualizerLyricsSetting(enabled) {
    const on = enabled !== false && enabled !== 'false';
    localStorage.setItem('riff_tvk_visualizer_lyrics', on ? 'true' : 'false');
    const tv = document.getElementById('tv-karaoke');
    if (tv) {
      tv.classList.toggle('tvk-show-lyrics-visualizer', on);
    }
    const btnTvkVisLyrics = document.getElementById('btn-tvk-visualizer-lyrics');
    if (btnTvkVisLyrics) btnTvkVisLyrics.classList.toggle('active', on);
    const btnTvkVisLyricsSetting = document.getElementById('btn-tvk-visualizer-lyrics-setting');
    if (btnTvkVisLyricsSetting) btnTvkVisLyricsSetting.classList.toggle('active', on);
    if (on && state.isPlaying) {
      if (audioEngine && audioEngine.setAnalyserEnabled) audioEngine.setAnalyserEnabled(true);
      startVisualizers();
    }
  }

  function updateTvkVisualizerOpacity(opacityVal) {
    let val = parseInt(opacityVal, 10);
    if (isNaN(val)) val = 85;
    val = Math.max(10, Math.min(100, val));
    localStorage.setItem('riff_tvk_visualizer_opacity', val.toString());

    const norm = (val / 100).toFixed(2);
    const tv = document.getElementById('tv-karaoke');
    if (tv) {
      tv.style.setProperty('--tvk-vis-opacity', norm);
    }

    const sliderPanel = document.getElementById('tvk-vis-opacity');
    if (sliderPanel && parseInt(sliderPanel.value, 10) !== val) sliderPanel.value = val;
    const valPanel = document.getElementById('val-tvk-vis-opacity');
    if (valPanel) valPanel.textContent = `${val}%`;

    const sliderSetting = document.getElementById('slider-tvk-vis-opacity-setting');
    if (sliderSetting && parseInt(sliderSetting.value, 10) !== val) sliderSetting.value = val;
    const valSetting = document.getElementById('val-tvk-vis-opacity-setting');
    if (valSetting) valSetting.textContent = `${val}%`;
  }

  function updateRangeProg(slider) {
    if (!slider) return;
    const min = parseFloat(slider.min || 0);
    const max = parseFloat(slider.max || 100);
    const val = parseFloat(slider.value || 0);
    const ratio = max > min ? Math.max(0, Math.min(1, (val - min) / (max - min))) : 0.5;
    slider.style.setProperty('--prog', `${ratio * 100}%`);
    const sl = slider.closest('.sl');
    if (sl) sl.style.setProperty('--v', ratio);
  }

  function applyTvk() {
    const tv = document.getElementById('tv-karaoke');
    if (!tv) return;
    const s = getTvk();
    const font = TVK_FONTS[s.font] || TVK_FONTS['Google Sans'];
    if (s.font === 'SF Pro' || (typeof font === 'string' && font.includes('SF Pro'))) {
      ensureSfFontLoaded();
    }
    const align = ['left', 'center', 'right'].includes(s.align) ? s.align : 'center';
    const scale = (Number(s.size) || 100) / 100;
    const weight = Number(s.weight) || 500;
    const gap = (s.gap !== undefined && !isNaN(Number(s.gap))) ? Number(s.gap) : 16;
    const speed = Number(s.speed) || 900;
    const anim = ['smooth', 'slide', 'fade', 'pop', 'none'].includes(s.anim) ? s.anim : 'slide';

    tv.style.setProperty('--tvk-font', font);
    tv.style.setProperty('--tvk-scale', String(scale));
    tv.style.setProperty('--tvk-weight', String(weight));
    tv.style.setProperty('--tvk-gap', `${gap}px`);
    tv.style.setProperty('--tvk-speed', `${speed}ms`);
    tv.setAttribute('data-tvk-anim', anim);
    tv.setAttribute('data-tvk-align', align);

    const tvkVisOn = localStorage.getItem('riff_tvk_visualizer') !== 'false';
    tv.classList.toggle('no-tvk-visualizer', !tvkVisOn);
    const tvkVisLyricsOn = localStorage.getItem('riff_tvk_visualizer_lyrics') !== 'false';
    tv.classList.toggle('tvk-show-lyrics-visualizer', tvkVisLyricsOn);
    const visOpacity = parseInt(localStorage.getItem('riff_tvk_visualizer_opacity') || '85', 10);
    tv.style.setProperty('--tvk-vis-opacity', (Math.max(10, Math.min(100, visOpacity)) / 100).toFixed(2));
    const bgBlur = parseInt(localStorage.getItem('riff_tvk_bg_blur') || '22', 10);
    tv.style.setProperty('--tvk-bg-blur', `${Math.max(0, Math.min(60, bgBlur))}px`);
    tv.classList.toggle('no-bg-blur', bgBlur <= 1);
    syncTvkAmbientBg();
    if (typeof layoutLyricsCascade === 'function' && state.isTvKaraokeOpen) {
      layoutLyricsCascade(state.lastActiveLyricIdx, true);
    }
  }

  function syncTvkUI() {
    const s = getTvk();
    const selFont = document.getElementById('tvk-font');
    const sliderSize = document.getElementById('tvk-size');
    const sliderWeight = document.getElementById('tvk-weight');
    const sliderGap = document.getElementById('tvk-gap');
    const selAnim = document.getElementById('tvk-anim');
    const sliderSpeed = document.getElementById('tvk-speed');

    const valSize = document.getElementById('val-tvk-size');
    const valWeight = document.getElementById('val-tvk-weight');
    const valGap = document.getElementById('val-tvk-gap');
    const valSpeed = document.getElementById('val-tvk-speed');

    const fontVal = s.font || 'Google Sans';
    if (selFont) {
      selFont.value = fontVal;
    }
    const fontLabel = document.getElementById('tvk-font-label');
    const fontMenu = document.getElementById('tvk-font-menu');
    if (fontMenu) {
      const options = fontMenu.querySelectorAll('.m3-dropdown-option');
      let matched = false;
      options.forEach(opt => {
        const isMatch = opt.dataset.value === fontVal;
        opt.classList.toggle('selected', isMatch);
        if (isMatch) {
          if (fontLabel) fontLabel.textContent = opt.textContent;
          matched = true;
        }
      });
      if (!matched && fontLabel) fontLabel.textContent = fontVal;
    }

    const alignGroup = document.getElementById('tvk-align-group');
    if (alignGroup) {
      alignGroup.querySelectorAll('.tvk-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === s.align);
      });
    }

    const animGroup = document.getElementById('tvk-anim-group');
    if (animGroup) {
      animGroup.querySelectorAll('.tvk-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === s.anim);
      });
    }
    if (selAnim) selAnim.value = s.anim;

    if (sliderSize) { sliderSize.value = s.size; updateRangeProg(sliderSize); }
    if (sliderWeight) { sliderWeight.value = s.weight; updateRangeProg(sliderWeight); }
    if (sliderGap) { sliderGap.value = s.gap; updateRangeProg(sliderGap); }
    if (sliderSpeed) { sliderSpeed.value = s.speed; updateRangeProg(sliderSpeed); }

    if (valSize) valSize.textContent = `${s.size}%`;
    if (valWeight) valWeight.textContent = `${s.weight}`;
    if (valGap) valGap.textContent = `${s.gap}px`;
    if (valSpeed) valSpeed.textContent = `${s.speed}ms`;
    const sliderViscosity = document.getElementById('tvk-viscosity');
    const valViscosity = document.getElementById('val-tvk-viscosity');
    const viscVal = s.viscosity || 1450;
    if (sliderViscosity) { sliderViscosity.value = viscVal; updateRangeProg(sliderViscosity); }
    if (valViscosity) valViscosity.textContent = `${(viscVal / 1000).toFixed(2)}s`;

    const tvkVisOn = localStorage.getItem('riff_tvk_visualizer') !== 'false';
    const btnTvkVis = document.getElementById('btn-tvk-visualizer');
    if (btnTvkVis) btnTvkVis.classList.toggle('active', tvkVisOn);
    const btnTvkVisSetting = document.getElementById('btn-tvk-visualizer-setting');
    if (btnTvkVisSetting) btnTvkVisSetting.classList.toggle('active', tvkVisOn);

    const tvkVisLyricsOn = localStorage.getItem('riff_tvk_visualizer_lyrics') !== 'false';
    const btnTvkVisLyrics = document.getElementById('btn-tvk-visualizer-lyrics');
    if (btnTvkVisLyrics) btnTvkVisLyrics.classList.toggle('active', tvkVisLyricsOn);
    const btnTvkVisLyricsSetting = document.getElementById('btn-tvk-visualizer-lyrics-setting');
    if (btnTvkVisLyricsSetting) btnTvkVisLyricsSetting.classList.toggle('active', tvkVisLyricsOn);

    const tvkVizStyleDropEl = document.getElementById('tvk-viz-style-dropdown');
    if (tvkVizStyleDropEl) tvkVizStyleDropEl.value = getVizStyle();

    const visOpacity = parseInt(localStorage.getItem('riff_tvk_visualizer_opacity') || '85', 10);
    const sliderTvkVisOpacity = document.getElementById('tvk-vis-opacity');
    if (sliderTvkVisOpacity) { sliderTvkVisOpacity.value = visOpacity; updateRangeProg(sliderTvkVisOpacity); }
    const valTvkVisOpacity = document.getElementById('val-tvk-vis-opacity');
    if (valTvkVisOpacity) valTvkVisOpacity.textContent = `${visOpacity}%`;

    const sliderTvkVisOpacitySetting = document.getElementById('slider-tvk-vis-opacity-setting');
    if (sliderTvkVisOpacitySetting) { sliderTvkVisOpacitySetting.value = visOpacity; updateRangeProg(sliderTvkVisOpacitySetting); }
    const valTvkVisOpacitySetting = document.getElementById('val-tvk-vis-opacity-setting');
    if (valTvkVisOpacitySetting) valTvkVisOpacitySetting.textContent = `${visOpacity}%`;

    const bgBlur = parseInt(localStorage.getItem('riff_tvk_bg_blur') || '22', 10);
    const sliderTvkBgBlur = document.getElementById('tvk-bg-blur');
    if (sliderTvkBgBlur) { sliderTvkBgBlur.value = bgBlur; updateRangeProg(sliderTvkBgBlur); }
    const valTvkBgBlur = document.getElementById('val-tvk-bg-blur');
    if (valTvkBgBlur) valTvkBgBlur.textContent = `${bgBlur}px`;

    const sliderTvkBgBlurSetting = document.getElementById('slider-tvk-bg-blur-setting');
    if (sliderTvkBgBlurSetting) { sliderTvkBgBlurSetting.value = bgBlur; updateRangeProg(sliderTvkBgBlurSetting); }
    const valTvkBgBlurSetting = document.getElementById('val-tvk-bg-blur-setting');
    if (valTvkBgBlurSetting) valTvkBgBlurSetting.textContent = `${bgBlur}px`;
  }

  function initTvk() {
    if (localStorage.getItem('riff_tvk_blur_reset_v1') !== '1') {
      localStorage.setItem('riff_tvk_blur_reset_v1', '1');
      localStorage.setItem('riff_tvk_bg_blur', '22');
    }

    const btnSettings = document.getElementById('btn-tvk-settings');
    const panel = document.getElementById('tvk-panel');
    const btnReset = document.getElementById('btn-tvk-reset');

    const selFont = document.getElementById('tvk-font');
    const fontDropdown = document.getElementById('tvk-font-dropdown');
    const fontTrigger = document.getElementById('tvk-font-trigger');
    const fontMenu = document.getElementById('tvk-font-menu');

    const alignGroup = document.getElementById('tvk-align-group');
    const animGroup = document.getElementById('tvk-anim-group');

    const sliderSize = document.getElementById('tvk-size');
    const sliderWeight = document.getElementById('tvk-weight');
    const sliderGap = document.getElementById('tvk-gap');
    const selAnim = document.getElementById('tvk-anim');
    const sliderSpeed = document.getElementById('tvk-speed');

    const valSize = document.getElementById('val-tvk-size');
    const valWeight = document.getElementById('val-tvk-weight');
    const valGap = document.getElementById('val-tvk-gap');
    const valSpeed = document.getElementById('val-tvk-speed');

    const allowedTvkFonts = [
      { id: 'Google Sans', label: 'Google Sans' },
      { id: 'SF Pro', label: 'SF Pro' },
      { id: 'System', label: 'System' }
    ];
    if (selFont) {
      selFont.innerHTML = allowedTvkFonts.map(f => `<option value="${f.id}">${f.label}</option>`).join('');
    }
    if (fontMenu) {
      fontMenu.innerHTML = allowedTvkFonts.map(f => `<button class="m3-dropdown-option" data-value="${f.id}" type="button">${f.label}</button>`).join('');
    }

    if (selAnim) {
      const r = selAnim.closest('.tvk-row');
      if (r) r.style.display = 'none';
    }
    if (animGroup) {
      const r = animGroup.closest('.tvk-row');
      if (r) r.style.display = 'none';
    }
    if (sliderSpeed) {
      const r = sliderSpeed.closest('.tvk-row');
      if (r) r.style.display = 'none';
    }
    if (panel && !document.getElementById('tvk-viscosity')) {
      const inner = panel.querySelector('.tvk-panel-inner') || panel;
      const gapRow = sliderGap ? sliderGap.closest('.tvk-row') : null;
      const viscRow = document.createElement('div');
      viscRow.className = 'tvk-row';
      const initVisc = getTvk().viscosity || 1450;
      viscRow.innerHTML = `
        <div class="tvk-row-header">
          <span class="tvk-label" data-i18n>${escapeHtml(t('Viscosity time'))}</span>
          <span class="tvk-val" id="val-tvk-viscosity">${(initVisc / 1000).toFixed(2)}s</span>
        </div>
        <input type="range" class="pill-range" id="tvk-viscosity" min="600" max="2400" step="50" value="${initVisc}">
      `;
      if (gapRow && gapRow.nextSibling) inner.insertBefore(viscRow, gapRow.nextSibling);
      else inner.appendChild(viscRow);
      if (typeof enhanceSliders === 'function') enhanceSliders(viscRow);
      const slVisc = viscRow.querySelector('#tvk-viscosity');
      const vlVisc = viscRow.querySelector('#val-tvk-viscosity');
      if (slVisc) {
        const onViscInput = () => {
          const cur = getTvk();
          cur.viscosity = Number(slVisc.value) || 1450;
          saveTvk(cur);
          if (vlVisc) vlVisc.textContent = `${(cur.viscosity / 1000).toFixed(2)}s`;
          updateRangeProg(slVisc);
          applyTvk();
        };
        slVisc.addEventListener('input', onViscInput);
        slVisc.addEventListener('change', onViscInput);
      }
    }

    applyTvk();
    syncTvkUI();
    syncTvkAmbientBg();
    syncTvkAmbientPlayback();

    let tvkCloseTimer = null;
    const openTvkPanel = () => {
      if (tvkCloseTimer) { clearTimeout(tvkCloseTimer); tvkCloseTimer = null; }
      if (panel) panel.classList.add('open');
      if (btnSettings) btnSettings.classList.add('open');
    };
    const closeTvkPanel = () => {
      if (panel) panel.classList.remove('open');
      if (btnSettings) btnSettings.classList.remove('open');
      const fontDropdown = document.getElementById('tvk-font-dropdown');
      if (fontDropdown) fontDropdown.classList.remove('open');
      resetTvIdleTimer();
    };
    const scheduleCloseTvkPanel = () => {
      if (tvkCloseTimer) clearTimeout(tvkCloseTimer);
      tvkCloseTimer = setTimeout(() => {
        const fontDropdown = document.getElementById('tvk-font-dropdown');
        if (fontDropdown && fontDropdown.classList.contains('open')) return;
        closeTvkPanel();
      }, 320);
    };

    const topZone = document.getElementById('tvk-top-hover-zone');
    if (topZone) {
      topZone.addEventListener('mouseenter', openTvkPanel);
      topZone.addEventListener('mouseleave', scheduleCloseTvkPanel);
    }
    if (panel) {
      panel.addEventListener('mouseenter', openTvkPanel);
      panel.addEventListener('mouseleave', scheduleCloseTvkPanel);
    }

    if (btnSettings && panel) {
      btnSettings.onclick = (e) => {
        e.stopPropagation();
        const isOpen = panel.classList.contains('open');
        if (!isOpen) {
          openTvkPanel();
        } else {
          closeTvkPanel();
        }
      };
    }

    document.addEventListener('click', (e) => {
      if (!panel || !panel.classList.contains('open')) return;
      if (!panel.contains(e.target) && (!btnSettings || !btnSettings.contains(e.target))) {
        closeTvkPanel();
      }
    });

    if (fontTrigger && fontDropdown) {
      fontTrigger.onclick = (e) => {
        e.stopPropagation();
        fontDropdown.classList.toggle('open');
      };
    }

    if (fontMenu) {
      fontMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.dataset.value;
          if (selFont) selFont.value = val;
          const current = getTvk();
          current.font = val;
          saveTvk(current);
          applyTvk();
          syncTvkUI();
          if (fontDropdown) fontDropdown.classList.remove('open');
          if (panel && !panel.matches(':hover') && (!topZone || !topZone.matches(':hover'))) {
            scheduleCloseTvkPanel();
          }
        });
      });
    }

    if (alignGroup) {
      alignGroup.querySelectorAll('.tvk-pill-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = btn.dataset.value;
          const current = getTvk();
          current.align = val;
          saveTvk(current);
          applyTvk();
          syncTvkUI();
        });
      });
    }

    const onTvkInput = () => {
      const current = getTvk();
      const tvk = {
        font: (selFont && selFont.value) || current.font || 'Google Sans',
        align: current.align || 'center',
        size: Number(sliderSize && sliderSize.value) || 100,
        weight: Number(sliderWeight && sliderWeight.value) || 500,
        gap: (sliderGap && sliderGap.value !== undefined) ? Number(sliderGap.value) : 16,
        anim: current.anim || 'slide',
        speed: Number(sliderSpeed && sliderSpeed.value) || 900
      };
      saveTvk(tvk);
      applyTvk();
      if (valSize) valSize.textContent = `${tvk.size}%`;
      if (valWeight) valWeight.textContent = `${tvk.weight}`;
      if (valGap) valGap.textContent = `${tvk.gap}px`;
      if (sliderSize) updateRangeProg(sliderSize);
      if (sliderWeight) updateRangeProg(sliderWeight);
      if (sliderGap) updateRangeProg(sliderGap);
    };

    [sliderSize, sliderWeight, sliderGap].forEach(input => {
      if (!input) return;
      input.addEventListener('input', onTvkInput);
      input.addEventListener('change', onTvkInput);
    });

    if (btnReset) {
      btnReset.onclick = () => {
        saveTvk(TVK_DEFAULTS);
        updateTvkVisualizerSetting(true);
        updateTvkVisualizerLyricsSetting(true);
        updateTvkVisualizerOpacity(85);
        applyTvk();
        syncTvkUI();
      };
    }

    const btnTvkVis = document.getElementById('btn-tvk-visualizer');
    if (btnTvkVis) {
      btnTvkVis.addEventListener('click', () => {
        const cur = localStorage.getItem('riff_tvk_visualizer') !== 'false';
        updateTvkVisualizerSetting(!cur);
      });
    }
    const btnTvkVisSetting = document.getElementById('btn-tvk-visualizer-setting');
    if (btnTvkVisSetting) {
      btnTvkVisSetting.addEventListener('click', () => {
        const cur = localStorage.getItem('riff_tvk_visualizer') !== 'false';
        updateTvkVisualizerSetting(!cur);
      });
    }

    const btnTvkVisLyrics = document.getElementById('btn-tvk-visualizer-lyrics');
    if (btnTvkVisLyrics) {
      btnTvkVisLyrics.addEventListener('click', () => {
        const cur = localStorage.getItem('riff_tvk_visualizer_lyrics') !== 'false';
        updateTvkVisualizerLyricsSetting(!cur);
      });
    }
    const btnTvkVisLyricsSetting = document.getElementById('btn-tvk-visualizer-lyrics-setting');
    if (btnTvkVisLyricsSetting) {
      btnTvkVisLyricsSetting.addEventListener('click', () => {
        const cur = localStorage.getItem('riff_tvk_visualizer_lyrics') !== 'false';
        updateTvkVisualizerLyricsSetting(!cur);
      });
    }

    const sliderTvkVisOpacity = document.getElementById('tvk-vis-opacity');
    if (sliderTvkVisOpacity) {
      const onOpInput = (e) => {
        updateTvkVisualizerOpacity(e.target.value);
        updateRangeProg(e.target);
      };
      sliderTvkVisOpacity.addEventListener('input', onOpInput);
      sliderTvkVisOpacity.addEventListener('change', onOpInput);
    }
    const sliderTvkVisOpacitySetting = document.getElementById('slider-tvk-vis-opacity-setting');
    if (sliderTvkVisOpacitySetting) {
      const onOpInput = (e) => {
        updateTvkVisualizerOpacity(e.target.value);
        updateRangeProg(e.target);
      };
      sliderTvkVisOpacitySetting.addEventListener('input', onOpInput);
      sliderTvkVisOpacitySetting.addEventListener('change', onOpInput);
    }

    const sliderTvkBgBlur = document.getElementById('tvk-bg-blur');
    const sliderTvkBgBlurSetting = document.getElementById('slider-tvk-bg-blur-setting');
    const valTvkBgBlur = document.getElementById('val-tvk-bg-blur');
    const valTvkBgBlurSetting = document.getElementById('val-tvk-bg-blur-setting');
    const syncTvkBgBlurUI = (v) => {
      if (sliderTvkBgBlur && sliderTvkBgBlur.value !== String(v)) sliderTvkBgBlur.value = v;
      if (sliderTvkBgBlurSetting && sliderTvkBgBlurSetting.value !== String(v)) sliderTvkBgBlurSetting.value = v;
      if (sliderTvkBgBlur) updateRangeProg(sliderTvkBgBlur);
      if (sliderTvkBgBlurSetting) updateRangeProg(sliderTvkBgBlurSetting);
      if (valTvkBgBlur) valTvkBgBlur.textContent = `${v}px`;
      if (valTvkBgBlurSetting) valTvkBgBlurSetting.textContent = `${v}px`;
    };
    let tvkBlurDebounceTimer = null;
    const updateTvkBgBlur = (v, immediate = false) => {
      const val = Math.max(0, Math.min(60, parseInt(v, 10) || 0));
      localStorage.setItem('riff_tvk_bg_blur', String(val));
      syncTvkBgBlurUI(val);
      applyTvk();
      if (immediate) {
        if (tvkBlurDebounceTimer) clearTimeout(tvkBlurDebounceTimer);
        syncTvkAmbientBg(true);
      } else {
        if (tvkBlurDebounceTimer) clearTimeout(tvkBlurDebounceTimer);
        tvkBlurDebounceTimer = setTimeout(() => {
          syncTvkAmbientBg(true);
        }, 40);
      }
    };
    syncTvkBgBlurUI(parseInt(localStorage.getItem('riff_tvk_bg_blur') || '22', 10));
    [sliderTvkBgBlur, sliderTvkBgBlurSetting].forEach(s => {
      if (!s) return;
      s.addEventListener('input', (e) => updateTvkBgBlur(e.target.value, false));
      s.addEventListener('change', (e) => updateTvkBgBlur(e.target.value, true));
    });

    const sliderVizSmooth = document.getElementById('slider-viz-smooth');
    const valVizSmooth = document.getElementById('val-viz-smooth');
    const sliderBarVizSmooth = document.getElementById('slider-bar-viz-smooth');
    const valBarVizSmooth = document.getElementById('val-bar-viz-smooth');
    const initialVizSmooth = localStorage.getItem('riff_viz_smooth') || '55';
    function syncSmooth(v) {
      if (sliderVizSmooth) sliderVizSmooth.value = v;
      if (valVizSmooth) valVizSmooth.textContent = `${v}%`;
      if (sliderBarVizSmooth) sliderBarVizSmooth.value = v;
      if (valBarVizSmooth) valBarVizSmooth.textContent = `${v}%`;
    }
    syncSmooth(initialVizSmooth);
    const onSmoothInput = (e) => {
      const v = e.target.value;
      localStorage.setItem('riff_viz_smooth', v);
      syncSmooth(v);
    };
    if (sliderVizSmooth) {
      sliderVizSmooth.addEventListener('input', onSmoothInput);
      sliderVizSmooth.addEventListener('change', onSmoothInput);
    }
    if (sliderBarVizSmooth) {
      sliderBarVizSmooth.addEventListener('input', onSmoothInput);
      sliderBarVizSmooth.addEventListener('change', onSmoothInput);
    }

    const sliderVizSens = document.getElementById('slider-viz-sens');
    const valVizSens = document.getElementById('val-viz-sens');
    const sliderBarVizSens = document.getElementById('slider-bar-viz-sens');
    const valBarVizSens = document.getElementById('val-bar-viz-sens');
    const initialVizSens = localStorage.getItem('riff_viz_sens') || '100';
    function syncSens(v) {
      if (sliderVizSens) sliderVizSens.value = v;
      if (valVizSens) valVizSens.textContent = `${v}%`;
      if (sliderBarVizSens) sliderBarVizSens.value = v;
      if (valBarVizSens) valBarVizSens.textContent = `${v}%`;
    }
    syncSens(initialVizSens);
    const onSensInput = (e) => {
      const v = e.target.value;
      localStorage.setItem('riff_viz_sens', v);
      syncSens(v);
    };
    if (sliderVizSens) {
      sliderVizSens.addEventListener('input', onSensInput);
      sliderVizSens.addEventListener('change', onSensInput);
    }
    if (sliderBarVizSens) {
      sliderBarVizSens.addEventListener('input', onSensInput);
      sliderBarVizSens.addEventListener('change', onSensInput);
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        saveTvk(TVK_DEFAULTS);
        updateTvkVisualizerSetting(true);
        updateTvkVisualizerLyricsSetting(true);
        updateTvkVisualizerOpacity(85);
        applyTvk();
        syncTvkUI();
      });
    }
  }


  function openCustomLyricsEditor() {
    if (!state.currentTrack) {
      showToast('Play a track first to add lyrics', 'info');
      return;
    }
    if (el.customLyricsTrackTitle) el.customLyricsTrackTitle.textContent = (state.currentTrack.title || 'untitled');
    if (el.customLyricsTrackArtist) el.customLyricsTrackArtist.textContent = (state.currentTrack.artist || '');

    if (state.syncedLyrics && state.syncedLyrics.length > 0 && el.customLyricsTextarea) {
      el.customLyricsTextarea.value = state.syncedLyrics.map(l => l.isGap ? '[Instrumental]' : l.text).join('\n');
    } else {
      if (el.customLyricsTextarea) el.customLyricsTextarea.value = '';
    }
    if (el.customLyricsModal) {
      openModal(el.customLyricsModal);
      if (el.customLyricsTextarea) setTimeout(() => el.customLyricsTextarea.focus(), 100);
    }
  }

  function closeCustomLyricsEditor() {
    if (el.customLyricsModal) closeModal(el.customLyricsModal);
  }

  async function saveCustomLyrics() {
    if (!state.currentTrack || !el.customLyricsTextarea) return;
    const rawText = el.customLyricsTextarea.value;
    const text = rawText.trim();

    const title = state.currentTrack.title || '';
    const artist = state.currentTrack.artist || '';

    const oldLines = (state.syncedLyrics || []).filter(l => !l.isGap);
    const newTextLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const hasSync = oldLines.some(l => typeof l.time === 'number' && l.time >= 0);
    const sameLineCount = hasSync && oldLines.length > 0 && oldLines.length === newTextLines.length;

    let textToSave = text;
    if (sameLineCount) {
      const lrcLines = newTextLines.map((lineText, idx) => {
        const oldLine = oldLines[idx];
        if (oldLine && typeof oldLine.time === 'number' && oldLine.time >= 0) {
          const m = Math.floor(oldLine.time / 60);
          const s = Math.floor(oldLine.time % 60);
          const ms = Math.floor((oldLine.time % 1) * 100);
          const timeTag = `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}]`;
          return `${timeTag}${lineText}`;
        }
        return lineText;
      });
      textToSave = lrcLines.join('\n');
    }

    try {
      const res = await fetch(
        `http://127.0.0.1:${state.serverPort}/api/save-custom-lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lyrics: textToSave })
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');

      showToast(text ? 'Lyrics saved successfully' : 'Lyrics removed', 'info');
      closeCustomLyricsEditor();
      lyricsSessionCache.clear();
      wordsSessionCache.clear();
      state.lastActiveLyricIdx = -1;
      state.forceLyricsScroll = true;
      state.forceSnapLyrics = true;
      state.isCustomLyrics = true;
      if (!text) {
        state.syncedLyrics = [];
        if (el.lyricsStatus) el.lyricsStatus.textContent = 'Custom';
        if (el.lyricsContainer) {
          el.lyricsContainer.innerHTML = '';
          el.lyricsContainer.scrollTop = 0;
          el.lyricsContainer.style.opacity = '1';
        }
        setRightPanelLyricsEmptySmooth(true);
        updateTvKaraokeMeta();
      } else {
        if (sameLineCount) {
          state.syncedLyrics = newTextLines.map((lineText, idx) => {
            const oldLine = oldLines[idx];
            return {
              time: (oldLine && typeof oldLine.time === 'number') ? oldLine.time : -1,
              text: lineText,
              words: (oldLine && oldLine.text === lineText) ? oldLine.words : null
            };
          });
        } else {
          state.syncedLyrics = newTextLines.map(lineText => ({ time: -1, text: lineText }));
        }
        renderLyricsView();
        await loadSyncedLyrics(title, artist, state.loadToken);
      }
    } catch (e) {
      showToast('Failed to save lyrics: ' + e.message, 'error');
    }
  }

  if (el.btnAddCustomLyrics) el.btnAddCustomLyrics.addEventListener('click', openCustomLyricsEditor);
  if (el.btnTvkEditLyrics) el.btnTvkEditLyrics.addEventListener('click', openCustomLyricsEditor);
  if (el.btnCloseCustomLyrics) el.btnCloseCustomLyrics.addEventListener('click', closeCustomLyricsEditor);
  if (el.btnCancelCustomLyrics) el.btnCancelCustomLyrics.addEventListener('click', closeCustomLyricsEditor);
  if (el.btnSaveCustomLyrics) el.btnSaveCustomLyrics.addEventListener('click', saveCustomLyrics);

  if (el.customLyricsModal) {
    el.customLyricsModal.addEventListener('click', (e) => {
      if (e.target === el.customLyricsModal) closeCustomLyricsEditor();
    });
  }

  syncState = {
    active: false,
    canTap: false,
    track: null,
    lines: [],
    currentIndex: 0
  };

  async function openSyncMode() {
    if (!state.currentTrack) {
      showToast('Play a track first to sync lyrics', 'info');
      return;
    }

    if (state.syncedLyrics.length === 0) {
      showToast('Add lyrics first using the edit button, then sync them', 'info');
      return;
    }

    const defaultPreset = (Array.isArray(defaultPresets) && defaultPresets.find(p => p.id === 'p_default')) || defaultPresets[0];
    if (defaultPreset && typeof applyPreset === 'function') {
      applyPreset(defaultPreset);
    }
    if (el.nativeAudio) {
      el.nativeAudio.playbackRate = 1.0;
      el.nativeAudio.currentTime = 0;
    }

    syncState.active = true;
    syncState.canTap = false;
    syncState.track = { ...state.currentTrack };
    syncState.lines = state.syncedLyrics.map(l => {
      const isGap = !!l.isGap || /^\[?\s*(?:instrumental|music|intro|outro|solo)\s*\]?$/i.test(l.text || '');
      const text = isGap ? '[Instrumental]' : (l.text || '').trim();
      return { text, isGap, time: null };
    }).filter(l => l.text);
    syncState.currentIndex = 0;

    const titleGroup = document.querySelector('#sync-mode-overlay .settings-title-group');
    if (titleGroup && !document.getElementById('sync-slot-counter')) {
      const counter = document.createElement('div');
      counter.id = 'sync-slot-counter';
      counter.className = 'sync-slot-counter';
      counter.innerHTML = `<span id="sync-slot-cur">0</span><span class="sync-slot-sep">/</span><span id="sync-slot-tot">0</span><span class="sync-slot-lbl">lines synced</span>`;
      titleGroup.appendChild(counter);
    }

    renderSyncLines();
    if (el.syncModeOverlay) openModal(el.syncModeOverlay);

    playSmooth();

    const audio = el.nativeAudio;
    if (audio && audio.readyState < 3) {
      showToast('Loading audio...', 'info');
      await new Promise((resolve) => {
        let done = false;
        const cleanup = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          audio.removeEventListener('canplay', onReady);
          audio.removeEventListener('playing', onReady);
          if (syncState._canPlayCleanup === cleanup) syncState._canPlayCleanup = null;
          resolve();
        };
        const onReady = () => cleanup();
        const timer = setTimeout(cleanup, 5000);
        syncState._canPlayCleanup = cleanup;
        audio.addEventListener('canplay', onReady, { once: true });
        audio.addEventListener('playing', onReady, { once: true });
      });
    }

    if (!syncState.active) return;
    syncState.canTap = true;
    showToast('Click or tap each line when you hear it', 'info');
  }

  function updateSyncProgress() {
    const synced = syncState.lines.filter(l => l.time !== null).length;
    const total = syncState.lines.length;
    const curEl = document.getElementById('sync-slot-cur');
    const totEl = document.getElementById('sync-slot-tot');
    if (curEl) curEl.textContent = synced;
    if (totEl) totEl.textContent = total;
    if (el.syncProgressText) el.syncProgressText.textContent = `${synced} / ${total} lines synced`;
  }

  function renderSyncLines() {
    if (!el.syncModeLyrics) return;
    const prevTop = el.syncModeLyrics.scrollTop;
    el.syncModeLyrics.innerHTML = '';
    syncState.lines.forEach((line, idx) => {
      const div = document.createElement('div');
      div.className = 'sync-line';
      div.textContent = line.text;

      if (line.isGap || line.text === '[Instrumental]') {
        div.classList.add('sync-line-gap');
        div.innerHTML = `<span class="sync-gap-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:4px;"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>[Instrumental]</span>`;
      }

      if (line.time !== null) {
        div.classList.add('synced');
        const min = Math.floor(line.time / 60);
        const sec = (line.time % 60).toFixed(2);
        div.setAttribute('data-time', `[${min}:${sec.padStart(5, '0')}]`);
      }

      if (idx === syncState.currentIndex && line.time === null) {
        div.classList.add('next-line');
      }

      div.addEventListener('click', () => handleSyncLineClick(idx));
      el.syncModeLyrics.appendChild(div);
    });

    el.syncModeLyrics.scrollTop = prevTop;
    updateSyncProgress();

    const nextEl = el.syncModeLyrics.querySelector('.next-line');
    if (nextEl) {
      const c = el.syncModeLyrics;
      const cr = c.getBoundingClientRect(), nr = nextEl.getBoundingClientRect();
      animateLyricsScroll(c, c.scrollTop + (nr.top - cr.top) - c.clientHeight / 2 + nr.height / 2);
    }
  }

  function handleSyncLineClick(idx) {
    if (!syncState.active || !el.nativeAudio) return;
    if (!syncState.canTap) {
      showToast('Loading audio...', 'info');
      return;
    }
    if (idx < 0 || idx >= syncState.lines.length) return;

    const currentTime = el.nativeAudio.currentTime || 0;
    syncState.lines[idx].time = currentTime;

    let next = -1;
    for (let i = idx + 1; i < syncState.lines.length; i++) {
      if (syncState.lines[i].time === null) {
        next = i;
        break;
      }
    }
    syncState.currentIndex = next >= 0 ? next : syncState.lines.length;

    renderSyncLines();
  }

  function restartSync() {
    syncState.lines.forEach(l => l.time = null);
    syncState.currentIndex = 0;
    if (el.nativeAudio) el.nativeAudio.currentTime = 0;
    renderSyncLines();
    showToast('Sync restarted', 'info');
  }

  async function saveSyncAndExit() {
    const targetTrack = syncState.track || state.currentTrack;
    if (!targetTrack) return;

    const lrcLines = syncState.lines.map(line => {
      if (line.time !== null) {
        const min = Math.floor(line.time / 60);
        const sec = (line.time % 60).toFixed(2);
        return `[${min}:${sec.padStart(5, '0')}]${line.text}`;
      }
      return line.text;
    });
    const lrcContent = lrcLines.join('\n');

    const title = targetTrack.title || '';
    const artist = targetTrack.artist || '';

    try {
      const res = await fetch(
        `http://127.0.0.1:${state.serverPort}/api/save-custom-lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lyrics: lrcContent })
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');

      showToast('Synced lyrics saved', 'info');
      closeSyncMode();
      lyricsSessionCache.clear();
      wordsSessionCache.clear();
      state.lastActiveLyricIdx = -1;
      state.forceLyricsScroll = true;
      state.forceSnapLyrics = true;
      await loadSyncedLyrics(title, artist, state.loadToken);
    } catch (e) {
      showToast('Failed to save synced lyrics: ' + e.message, 'error');
    }
  }

  function closeSyncMode() {
    if (syncState._canPlayCleanup) {
      syncState._canPlayCleanup();
      syncState._canPlayCleanup = null;
    }
    syncState.active = false;
    syncState.canTap = false;
    syncState.track = null;
    syncState.lines = [];
    syncState.currentIndex = 0;
    if (el.syncModeOverlay) {
      closeModal(el.syncModeOverlay);
      el.syncModeOverlay.classList.remove('visible');
      el.syncModeOverlay.classList.add('hidden');
    }
  }

  if (el.btnSyncLyrics) el.btnSyncLyrics.addEventListener('click', openSyncMode);
  if (el.btnTvkSyncLyrics) el.btnTvkSyncLyrics.addEventListener('click', openSyncMode);
  if (el.btnRestartSync) el.btnRestartSync.addEventListener('click', restartSync);
  if (el.btnSaveSync) el.btnSaveSync.addEventListener('click', saveSyncAndExit);
  if (el.btnCancelSync) el.btnCancelSync.addEventListener('click', closeSyncMode);

  if (el.syncModeOverlay) {
    el.syncModeOverlay.addEventListener('click', (e) => {
      if (e.target === el.syncModeOverlay) closeSyncMode();
    });
  }

  var isPauseFading = false;
  var frozenCurTime = 0;
  var smoothFadeToken = 0;
  var isAppClosing = false;
  window.addEventListener('beforeunload', () => {
    isAppClosing = true;
    saveLastPlaybackState();
  });


  function positionLyricsCallout() {}
  window.positionLyricsCallout = positionLyricsCallout;

  function syncOnboardingCallouts() {
    const lyrDone = localStorage.getItem('riff_lyrics_callout_dismissed_v1') === '1';
    const audDone = localStorage.getItem('riff_audio_callout_dismissed_v1') === '1';
    const lyrEl = document.getElementById('lyrics-here-callout');
    const audEl = document.getElementById('audio-editor-callout');

    if (!lyrDone) {
      if (lyrEl) lyrEl.classList.remove('hidden');
      if (audEl) audEl.classList.add('hidden');
    } else if (!audDone) {
      if (lyrEl) lyrEl.classList.add('hidden');
      if (audEl) audEl.classList.remove('hidden');
    } else {
      if (lyrEl) lyrEl.classList.add('hidden');
      if (audEl) audEl.classList.add('hidden');
    }
  }
  window.syncOnboardingCallouts = syncOnboardingCallouts;

  function initLyricsCallout() {
    const btnCloseLyrics = document.getElementById('btn-close-lyrics-callout');
    const btnLyrics = document.getElementById('btn-toggle-lyrics-panel');
    const btnCloseAudio = document.getElementById('btn-close-audio-callout');
    const btnSettings = document.getElementById('btn-open-settings');

    const dismissLyrics = (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      try {
        localStorage.setItem('riff_lyrics_callout_dismissed_v1', '1');
        if (typeof flushAsync === 'function') flushAsync();
        else if (typeof flushSync === 'function') flushSync();
      } catch (_) {}
      syncOnboardingCallouts();
    };

    const dismissAudio = (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      try {
        localStorage.setItem('riff_audio_callout_dismissed_v1', '1');
        if (typeof flushAsync === 'function') flushAsync();
        else if (typeof flushSync === 'function') flushSync();
      } catch (_) {}
      syncOnboardingCallouts();
    };

    if (btnCloseLyrics) btnCloseLyrics.addEventListener('click', dismissLyrics);
    if (btnLyrics) btnLyrics.addEventListener('click', dismissLyrics);
    if (btnCloseAudio) btnCloseAudio.addEventListener('click', dismissAudio);
    if (btnSettings) btnSettings.addEventListener('click', dismissAudio);

    syncOnboardingCallouts();
  }

  function initLyricsWarningsSetting() {
    const btn = document.getElementById('btn-lyrics-warnings');
    if (!btn) return;
    const isEnabled = localStorage.getItem('riff_show_lyrics_warnings') !== '0';
    btn.classList.toggle('active', isEnabled);
    btn.addEventListener('click', () => {
      const next = btn.classList.toggle('active');
      localStorage.setItem('riff_show_lyrics_warnings', next ? '1' : '0');
      if (state.currentTrack) {
        loadSyncedLyrics(state.currentTrack.title, state.currentTrack.artist, state.loadToken);
      } else {
        const warnEl = document.getElementById('lyrics-warn-badge');
        if (warnEl && !next) warnEl.classList.add('hidden');
      }
    });
  }



window.loadSyncedLyrics = loadSyncedLyrics;
window.renderLyricsView = renderLyricsView;
window.renderMiniLyrics = renderMiniLyrics;
window.updateSyncedLyricsHighlight = updateSyncedLyricsHighlight;
window.openTvKaraoke = openTvKaraoke;
window.closeTvKaraoke = closeTvKaraoke;
window.initTvk = initTvk;
window.openCustomLyricsEditor = openCustomLyricsEditor;
window.openSyncMode = openSyncMode;

