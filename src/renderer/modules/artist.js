
'use strict';

  async function updateRightPanelCredits(track) {
    const card = document.getElementById('rp-credits-card');
    const panel = el.rightPanel || document.getElementById('right-panel');
    if (!card || !panel) return;

    if (!track) {
      if (card) { card.classList.add('hidden'); card.innerHTML = ''; }
      panel?.classList.remove('has-credits');
      return;
    }

    if (!getAdv('track_credits', true)) {
      card.classList.add('hidden');
      card.innerHTML = '';
      if (panel.classList.contains('has-credits')) {
        const artworkBox = el.rightPanelArtworkBox || document.getElementById('right-panel-artwork-box');
        if (artworkBox) {
          flipAnimate([artworkBox], () => {
            panel.classList.remove('has-credits');
          });
        } else {
          panel.classList.remove('has-credits');
        }
      }
      return;
    }

    const isLocal = track.platform === 'local' || String(track.id || '').startsWith('local_') || Boolean(track.isLocal);
    const isTikTok = isStaticTikTokTrack(track) || (track && track.platform === 'tiktok');

    const hasInlineLyrics = !isLyricsFullscreenOnly() && ((state.syncedLyrics && state.syncedLyrics.length > 0) || !panel.classList.contains('lyrics-empty'));
    if (!isLocal && !isTikTok && hasInlineLyrics) {
      card.classList.add('hidden');
      card.innerHTML = '';
      if (panel.classList.contains('has-credits')) {
        const artworkBox = el.rightPanelArtworkBox || document.getElementById('right-panel-artwork-box');
        if (artworkBox) {
          flipAnimate([artworkBox], () => {
            panel.classList.remove('has-credits');
          });
        } else {
          panel.classList.remove('has-credits');
        }
      }
      return;
    }

    const token = ++currentCreditsToken;
    try {
      let credits = null;
      let writers = [];
      let composers = [];
      let producers = [];
      let performers = track.artist ? [track.artist] : [];

      if (!isLocal && !isTikTok) {
        const serverBase = state.serverPort ? `http://127.0.0.1:${state.serverPort}` : '';
        const res = await fetch(`${serverBase}/api/track-credits?title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}`);
        const data = await res.json();
        if (token !== currentCreditsToken) return;

        const hasInlineLyricsAfterFetch = !isLyricsFullscreenOnly() && ((state.syncedLyrics && state.syncedLyrics.length > 0) || !panel.classList.contains('lyrics-empty'));
        if (!getAdv('track_credits', true) || hasInlineLyricsAfterFetch) {
          card.classList.add('hidden');
          card.innerHTML = '';
          if (panel.classList.contains('has-credits')) {
            const artworkBox = el.rightPanelArtworkBox || document.getElementById('right-panel-artwork-box');
            if (artworkBox) {
              flipAnimate([artworkBox], () => {
                panel.classList.remove('has-credits');
              });
            } else {
              panel.classList.remove('has-credits');
            }
          }
          return;
        }

        credits = data && data.success ? data.credits : null;
        writers = (credits && credits.writers) || [];
        composers = (credits && credits.composers) || [];
        producers = (credits && credits.producers) || [];
        performers = (credits && credits.performers && credits.performers.length) ? credits.performers : (track.artist ? [track.artist] : []);
      }

      const matchedAlbum = (credits && credits.album && credits.album.title) ? credits.album : null;
      if (matchedAlbum && !track.album) {
        track.album = matchedAlbum.title;
      }

    const hasRealCredits = (composers.length > 0 || writers.length > 0 || producers.length > 0);
    const useFallback = isLocal || isTikTok || (!hasRealCredits && getAdv('credits_fallback', true));
    if (!hasRealCredits && !useFallback) {
      card.classList.add('hidden');
      card.innerHTML = '';
      if (panel.classList.contains('has-credits')) {
        const artworkBox = el.rightPanelArtworkBox || document.getElementById('right-panel-artwork-box');
        if (artworkBox) {
          flipAnimate([artworkBox], () => {
            panel.classList.remove('has-credits');
          });
        } else {
          panel.classList.remove('has-credits');
        }
      }
      return;
    }

      const peopleMap = new Map();
      const addPersonRole = (rawName, role) => {
        if (!rawName || typeof rawName !== 'string') return;
        const tokens = (typeof splitArtistTokens === 'function')
          ? splitArtistTokens(rawName).filter(tok => tok.type === 'artist')
          : [{ type: 'artist', value: rawName }];
        for (const tok of tokens) {
          const name = (tok.value || '').trim();
          if (!name) continue;
          const key = name.toLowerCase();
          if (!peopleMap.has(key)) {
            peopleMap.set(key, { displayName: name, roles: new Set() });
          }
          peopleMap.get(key).roles.add(role);
        }
      };

      if (useFallback) {
        const fallbackArtist = track.artist || 'Unknown Artist';
        ['Main Artist', 'Lyricist', 'Producer'].forEach(r => addPersonRole(fallbackArtist, r));
      } else {
        performers.forEach(name => addPersonRole(name, 'Main Artist'));
        composers.forEach(name => addPersonRole(name, 'Composer'));
        writers.forEach(name => addPersonRole(name, 'Lyricist'));
        producers.forEach(name => addPersonRole(name, 'Producer'));
      }

      const platInfo = getTrackPlatformInfo(track);

      let rowsHtml = '';
      let idx = 0;
      for (const p of peopleMap.values()) {
        const rolesStr = Array.from(p.roles).map(r => escapeHtml(t(r))).join(' • ');
        const isFollowed = typeof isArtistFollowed === 'function' ? isArtistFollowed(p.displayName) : false;
        const followBtn = (idx === 0 || p.roles.has('Main Artist'))
          ? `<button type="button" class="rp-credit-follow-btn ${isFollowed ? 'following' : ''}" data-artist="${escapeHtml(p.displayName)}">${escapeHtml(t(isFollowed ? 'Following' : 'Follow'))}</button>`
          : '';
        rowsHtml += `
          <div class="rp-credit-person-row">
            <div class="rp-credit-person-info">
              <span class="rp-credit-person-name" data-artist="${escapeHtml(p.displayName)}">${escapeHtml(p.displayName)}</span>
              <span class="rp-credit-person-roles">${rolesStr}</span>
            </div>
            ${followBtn}
          </div>
        `;
        idx++;
      }

      const albumRowHtml = matchedAlbum ? `
        <div class="rp-credits-album-row" id="rp-credits-album-btn"><img class="rp-credits-album-cover" src="${escapeHtml(matchedAlbum.cover || '')}" alt="" onerror="this.style.display='none'" /><div class="rp-credit-person-info"><span class="rp-credit-person-roles">${escapeHtml(t('Album'))}</span><span class="rp-credits-album-name">${escapeHtml(matchedAlbum.title)}${matchedAlbum.year ? ' • ' + escapeHtml(matchedAlbum.year) : ''}</span></div></div>
      ` : '';

      card.innerHTML = `
        <div class="rp-credits-head"><span class="rp-credits-heading">${escapeHtml(t('Credits'))}</span></div>
        ${rowsHtml}
        ${albumRowHtml}
        <div class="rp-credits-source-row"><span class="rp-credit-person-roles">${escapeHtml(t('Audio source'))}</span><div class="rp-credits-source-badge">${platInfo.svg}<span>${escapeHtml(platInfo.name)}</span></div></div>
      `;
      card.classList.remove('hidden');

      const albumBtn = card.querySelector('#rp-credits-album-btn');
      if (albumBtn && matchedAlbum) {
        albumBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof openAlbum === 'function') {
            openAlbum(matchedAlbum);
          }
        });
      }

      card.querySelectorAll('.rp-credit-person-name').forEach(elem => {
        elem.addEventListener('click', (e) => {
          e.stopPropagation();
          const artistName = elem.getAttribute('data-artist');
          if (artistName && typeof openArtistProfile === 'function') {
            openArtistProfile(artistName);
          }
        });
      });

      card.querySelectorAll('.rp-credit-follow-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const artistName = btn.getAttribute('data-artist');
          if (artistName && typeof toggleFollowArtist === 'function') {
            const nowFollowed = toggleFollowArtist(artistName);
            btn.classList.toggle('following', !!nowFollowed);
            btn.textContent = t(nowFollowed ? 'Following' : 'Follow');
          }
        });
      });

      const artworkBox = el.rightPanelArtworkBox || document.getElementById('right-panel-artwork-box');
      if (!panel.classList.contains('has-credits')) {
        if (artworkBox) {
          flipAnimate([artworkBox], () => {
            panel.classList.add('has-credits');
          });
        } else {
          panel.classList.add('has-credits');
        }
      } else {
        panel.classList.add('has-credits');
      }
    } catch (_) {
      if (token !== currentCreditsToken) return;
      card.classList.add('hidden');
      card.innerHTML = '';
      if (panel.classList.contains('has-credits')) {
        const artworkBox = el.rightPanelArtworkBox || document.getElementById('right-panel-artwork-box');
        if (artworkBox) {
          flipAnimate([artworkBox], () => {
            panel.classList.remove('has-credits');
          });
        } else {
          panel.classList.remove('has-credits');
        }
      }
    }
  }

  function updatePlaylistDetailBanner(thumbUrl) {
    const banner = document.getElementById('playlist-header-banner');
    if (!banner) return;
    if (!getAdv('banners', true)) {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = '';
    const bannerImg = banner.querySelector('.banner-image') || banner;
    const globalMedia = localStorage.getItem('riff_banner_media');
    const mediaToUse = globalMedia || thumbUrl;

    if (!mediaToUse) {
      banner.style.opacity = '0';
      bannerImg.style.backgroundImage = 'none';
      const vid = banner.querySelector('video.banner-video');
      if (vid) vid.remove();
      return;
    }

    const isVideo = /\.(mp4|webm)($|\?)/i.test(mediaToUse);
    if (isVideo) {
      bannerImg.style.backgroundImage = 'none';
      let vid = banner.querySelector('video.banner-video');
      if (!vid) {
        vid = document.createElement('video');
        vid.className = 'banner-video';
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.playsInline = true;
        banner.appendChild(vid);
      }
      if (vid.src !== mediaToUse) {
        vid.src = mediaToUse;
        vid.play().catch(() => {});
      }
      banner.style.opacity = '1';
      return;
    }

    const vid = banner.querySelector('video.banner-video');
    if (vid) vid.remove();

    const img = new Image();
    img.src = mediaToUse;
    img.onload = () => {
      bannerImg.style.backgroundImage = `url("${mediaToUse}")`;
      banner.style.opacity = '1';
    };
    img.onerror = () => {
      banner.style.opacity = '0';
    };
  }


  async function fetchArtistCardForSearch(query, token, searchTracks) {
    const container = document.getElementById('search-artist-card-container');
    if (!container) return;
    try {
      const normQ = normalizeImportText(query);
      let lookupName = query;
      let viaTrack = false;
      const topArtist = Array.isArray(searchTracks) && searchTracks[0] ? autoplayArtistList(searchTracks[0])[0] : '';
      if (topArtist) {
        const na = normalizeImportText(topArtist);
        const latQ = typeof normalizeForMatch === 'function' ? normalizeForMatch(query) : normQ;
        const latA = typeof normalizeForMatch === 'function' ? normalizeForMatch(topArtist) : na;
        const escaped = na.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const first3 = searchTracks.slice(0, 3);
        const shareArtist = first3.length > 0 && first3.every(t => {
          const a = autoplayArtistList(t)[0] || '';
          return a && (a.toLowerCase() === topArtist.toLowerCase() || (typeof normalizeForMatch === 'function' && normalizeForMatch(a) === latA));
        });
        const translitMatch = Boolean(latA && latQ && (latA === latQ || latQ.includes(latA) || latA.includes(latQ)));
        const regexMatch = na.length >= 2 && na !== normQ && new RegExp('(^|\\s)' + escaped + '(\\s|$)').test(normQ);

        if (shareArtist || translitMatch || regexMatch) {
          lookupName = topArtist;
          viaTrack = true;
        }
      }

      const hintForSearch = (Array.isArray(searchTracks) && searchTracks[0] && searchTracks[0].title) ? searchTracks[0].title : '';
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/artist?name=${encodeURIComponent(lookupName)}&hintTrack=${encodeURIComponent(hintForSearch)}`);
      const data = await res.json();
      if (state.searchToken !== token) return;
      if (!data.success || !data.artist || !data.artist.name) return;
      if (!data.artist.isKnownArtist) return;

      const artist = data.artist;
      const normA = normalizeImportText(artist.name);
      const latArtist = typeof normalizeForMatch === 'function' ? normalizeForMatch(artist.name) : normA;
      const latQ = typeof normalizeForMatch === 'function' ? normalizeForMatch(query) : normQ;

      if (!viaTrack) {
        const isExact = (normA === normQ) || (latArtist && latQ && latArtist === latQ);
        const isClose = ((normA.startsWith(normQ) || normQ.startsWith(normA)) && Math.abs(normA.length - normQ.length) <= 3) ||
                        ((latArtist.startsWith(latQ) || latQ.startsWith(latArtist)) && Math.abs(latArtist.length - latQ.length) <= 3);
        if (!isExact && !isClose) return;
        if (Array.isArray(searchTracks) && searchTracks.length > 0) {
          const topTrackTitle = normalizeImportText(searchTracks[0].title || '');
          const latTopTrackTitle = typeof normalizeForMatch === 'function' ? normalizeForMatch(searchTracks[0].title || '') : topTrackTitle;
          if ((topTrackTitle === normQ || latTopTrackTitle === latQ) && normA !== normQ && latArtist !== latQ) return;
        }
      }

      const avatarUrl = artist.avatar || (searchTracks && searchTracks[0] ? searchTracks[0].thumbnail : '');
      const fans = artist.fans || artist.nb_fan || 0;
      const label = fans > 0 ? `Artist \u2022 ${fans.toLocaleString()} listeners` : 'Artist';
      container.innerHTML = `
        <div class="search-artist-section">
          <div class="section-sub-header">
            <h3 data-i18n>${typeof t === 'function' ? t('Top result') : 'Top result'}</h3>
          </div>
          <div class="search-artist-card" role="button" tabindex="0">
            <div class="search-artist-avatar-wrap">
              ${avatarUrl ? `<img class="search-artist-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(artist.name)}" />` : '<div style="width:100%;height:100%;background:var(--md-sys-color-surface-container);"></div>'}
            </div>
            <div class="search-artist-info">
              <span class="search-artist-name">${escapeHtml(artist.name)}${artist.isVerified ? VERIFIED_CHECK_SVG : ''}</span>
              <span class="search-artist-label">${escapeHtml(label)}</span>
            </div>
          </div>
        </div>
      `;
      const open = () => {
        recordSearchArtist(artist.name, avatarUrl, artist.isVerified);
        openArtistProfile(artist.name, searchTracks && searchTracks[0] ? searchTracks[0] : null);
      };
      const card = container.querySelector('.search-artist-card');
      if (card) {
        card.addEventListener('click', open);
      }
      if (typeof applySearchFilter === 'function') applySearchFilter(currentSearchFilter);
    } catch (e) {}
  }

  var albumResolved = new Map();

  function normalizeMatchText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }


  async function resolveAlbumTrack(album, t) {
    if (!album || !t) return null;
    if (t.url || t.platform === 'local') return t;
    const albumId = album.id || '';
    const trackNo = t.no != null ? t.no : 1;
    const cacheKey = `${albumId}:${trackNo}`;
    if (albumResolved.has(cacheKey)) {
      return albumResolved.get(cacheKey);
    }

    const query = `${t.artist || album.artist || ''} ${t.title || ''}`.trim();
    const platform = state.platform || 'youtube';
    let picked = null;
    try {
      const url = `http://127.0.0.1:${state.serverPort}/api/search?q=${encodeURIComponent(query)}&platform=${platform}&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      const results = (data && Array.isArray(data.tracks)) ? data.tracks.slice(0, 5) : [];
      if (results.length > 0) {
        const normAlbumTitle = normalizeMatchText(t.title);
        const matching = normAlbumTitle
          ? results.filter(cand => normalizeMatchText(cand.title).includes(normAlbumTitle))
          : results;
        const targetSec = t.durationMs ? t.durationMs / 1000 : null;

        if (matching.length > 0) {
          if (targetSec != null) {
            picked = matching.find(c => {
              const cSec = toSeconds(c.duration);
              return cSec > 0 && Math.abs(cSec - targetSec) <= 6;
            }) || matching[0];
          } else {
            picked = matching[0];
          }
        } else {
          picked = results[0];
        }
      }
    } catch (err) {
      console.warn('[albums] resolve error:', err);
    }

    if (picked) {
      albumResolved.set(cacheKey, picked);
    }
    return picked;
  }

  async function playAlbumFrom(album, tracks, startIndex = 0) {
    if (!album || !tracks || !tracks.length) return;
    const runId = ++currentAlbumPlayRunId;

    const startIdx = Math.max(0, Math.min(startIndex, tracks.length - 1));
    const firstResolved = await resolveAlbumTrack(album, tracks[startIdx]);

    if (currentAlbumPlayRunId !== runId) return;

    if (!firstResolved) {
      showToast('Track not found', 'warning');
      return;
    }

    playTrack(firstResolved, [firstResolved], 0, 'album');

    const hasBusy = typeof beginBusy === 'function';
    if (hasBusy) beginBusy('import');

    try {
      const remaining = tracks.map((t, idx) => ({ t, idx })).filter(item => item.idx !== startIdx);
      const resolvedMap = new Map();
      let skippedCount = 0;

      await pool(remaining, 4, async (item) => {
        if (currentAlbumPlayRunId !== runId) return;
        const resTrack = await resolveAlbumTrack(album, item.t);
        if (currentAlbumPlayRunId !== runId) return;
        if (resTrack) {
          resolvedMap.set(item.idx, resTrack);
        } else {
          skippedCount++;
        }
      });

      if (currentAlbumPlayRunId !== runId) return;

      for (let i = 0; i < tracks.length; i++) {
        if (i === startIdx) continue;
        const cand = resolvedMap.get(i);
        if (!cand) continue;
        const alreadyInQueue = state.queue.some(q => isSameTrack(q, cand));
        if (!alreadyInQueue) {
          state.queue.push(cand);
        }
      }
      updateQueueBadge();
      if (state.currentView === 'queue') renderQueueView();

      if (skippedCount > 0) {
        showToast(`${skippedCount} tracks not found`, 'warning');
      }
    } finally {
      if (hasBusy) endBusy('import');
    }
  }

  var currentAlbumForFeedback = null;
  var mixFeedbackBusy = false;


  function getSavedAlbums() {
    try {
      const raw = localStorage.getItem('riff_saved_albums');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function setSavedAlbums(list) {
    try {
      localStorage.setItem('riff_saved_albums', JSON.stringify(list));
    } catch (_) {}
    updateAlbumsCount();
    if (typeof renderSidebarLibraryFeed === 'function') renderSidebarLibraryFeed();
  }

  window.updateAlbumsCount = updateAlbumsCount;
  function updateAlbumsCount() {
    setNavCount(document.getElementById('albums-count'), getSavedAlbums().length);
  }

  function renderSavedAlbums() {
    const container = document.getElementById('saved-albums-grid');
    if (!container) return;
    const saved = typeof getSavedAlbums === 'function' ? [...getSavedAlbums()] : [];
    const showLocal = localStorage.getItem('riff_show_local') !== 'false';
    const localCnt = (state.localTracks && state.localTracks.length) || 0;

    if (!showLocal && saved.length === 0) {
      container.innerHTML = '<div class="empty-hint" style="padding: 48px 0; text-align: center; width: 100%;">No saved albums yet. Save albums from the album view.</div>';
      return;
    }

    let html = '';
    if (showLocal) {
      html += `
        <div class="search-album-card local-album-card" id="card-saved-local" role="button" tabindex="0">
          <div class="search-album-cover local-grad" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, #1e293b, #0f172a);">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="search-album-info">
            <span class="search-album-title">${escapeHtml(t('My files'))}</span>
            <span class="search-album-sub">${localCnt} ${localCnt === 1 ? 'file' : 'files'}</span>
          </div>
        </div>
      `;
    }

    html += saved.map((album, idx) => {
      const sub = [album.type || 'Album', album.artist || ''].filter(Boolean).join(' · ');
      return `
        <div class="search-album-card" data-album-idx="${idx}" role="button" tabindex="0">
          ${album.cover ? `<img class="search-album-cover" src="${escapeHtml(album.cover)}" alt="${escapeHtml(album.title || '')}" loading="lazy" onerror="this.style.display='none'" />` : '<div class="search-album-cover" style="display:flex;align-items:center;justify-content:center;background:var(--md-sys-color-surface-container-high);"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--md-sys-color-outline);"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>'}
          <div class="search-album-info">
            <span class="search-album-title" title="${escapeHtml(album.title || '')}">${escapeHtml(album.title || '')}</span>
            <span class="search-album-sub" title="${escapeHtml(sub)}">${escapeHtml(sub)}</span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;

    const localCard = container.querySelector('#card-saved-local');
    if (localCard) {
      localCard.addEventListener('click', () => switchView('local'));
      localCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          switchView('local');
        }
      });
    }

    const cards = container.querySelectorAll('.search-album-card[data-album-idx]');
    cards.forEach(card => {
      const idx = parseInt(card.dataset.albumIdx, 10);
      const alb = saved[idx];
      if (!alb) return;
      card.addEventListener('click', () => openAlbum(alb));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          openAlbum(alb);
        }
      });
    });
  }
  window.renderSavedAlbums = renderSavedAlbums;

  var currentAlbumRunId = 0;

  async function openAlbum(album) {
    if (!album || !album.id) return;
    if (state.currentView === 'album' && state.currentAlbum && state.currentAlbum.id === album.id && state.currentAlbum._tracks && state.currentAlbum._tracks.length > 0) {
      return;
    }
    const runId = ++currentAlbumRunId;

    state.currentAlbum = album;
    currentAlbumForFeedback = album;
    state.previousView = state.currentView;
    switchView('album');

    const albumView = document.getElementById('view-album');
    const isDailyMix = album.type === 'Daily Mix' || !!album.isDailyMix || String(album.id || '').startsWith('daily-mix') || String(album.id || '').startsWith('dm_');
    if (albumView) {
      albumView.classList.toggle('is-daily-mix', isDailyMix);
    }
    const feedbackData = getMixFeedback();
    const existingRating = (feedbackData.ratingsByMix && album.id) ? feedbackData.ratingsByMix[album.id] : null;

    const bLike = document.getElementById('btn-dm-like');
    const bDislike = document.getElementById('btn-dm-dislike');
    if (bLike && bDislike) {
      if (isDailyMix) {
        bLike.style.display = 'inline-flex';
        bDislike.style.display = 'inline-flex';
        syncDailyMixRatingButtons(existingRating);
        bLike.onclick = (e) => { e.preventDefault(); e.stopPropagation(); handleDailyMixRating(true); };
        bDislike.onclick = (e) => { e.preventDefault(); e.stopPropagation(); handleDailyMixRating(false); };
      } else {
        bLike.style.display = 'none';
        bDislike.style.display = 'none';
      }
    }

    const mixFeedbackEl = document.getElementById('daily-mix-feedback');
    const btnSaveAlbum = document.getElementById('btn-save-album');
    if (!isDailyMix) {
      if (mixFeedbackEl) {
        mixFeedbackEl.classList.add('hidden');
        mixFeedbackEl.style.display = 'none';
      }
      if (btnSaveAlbum) {
        btnSaveAlbum.style.display = 'inline-flex';
        const updateBtnState = () => {
          const list = getSavedAlbums();
          const isSaved = list.some(a => (album.id && a.id === album.id) || (album.title && a.title === album.title && a.artist === album.artist));
          const svg = btnSaveAlbum.querySelector('svg');
          if (svg) svg.setAttribute('fill', isSaved ? 'currentColor' : 'none');
          btnSaveAlbum.classList.toggle('active', isSaved);
          btnSaveAlbum.title = isSaved ? 'Remove from saved albums' : 'Save album';
        };
        updateBtnState();
        btnSaveAlbum.onclick = (e) => {
          e.stopPropagation();
          let list = getSavedAlbums();
          const idx = list.findIndex(a => (album.id && a.id === album.id) || (album.title && a.title === album.title && a.artist === album.artist));
          if (idx >= 0) {
            list.splice(idx, 1);
          } else {
            list.unshift({
              id: album.id,
              title: album.title || '',
              artist: album.artist || '',
              cover: album.cover || '',
              type: album.type || 'Album',
              year: album.year || '',
              trackCount: album.trackCount || (album._tracks ? album._tracks.length : 0)
            });
            if (localStorage.getItem('riff_like_album_tracks') === 'true' && album._tracks && Array.isArray(album._tracks)) {
              let favAdded = false;
              album._tracks.forEach(tr => {
                if (tr && !state.favorites.some(f => isSameTrack(f, tr))) {
                  state.favorites.unshift(typeof stampAddedAt === 'function' ? stampAddedAt(tr) : tr);
                  favAdded = true;
                }
              });
              if (favAdded) {
                localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
                if (typeof updateFavoritesBadge === 'function') updateFavoritesBadge();
                if (typeof updateFavoriteIcon === 'function') updateFavoriteIcon();
                if (state.currentView === 'favorites' && typeof renderFavoritesView === 'function') renderFavoritesView();
              }
            }
          }
          setSavedAlbums(list);
          updateBtnState();
          if (state.currentView === 'albums') {
            renderSavedAlbums();
          }
        };
      }
    } else {
      if (btnSaveAlbum) {
        btnSaveAlbum.style.display = 'none';
      }
      if (mixFeedbackEl) {
        if (!existingRating) {
          mixFeedbackEl.classList.remove('hidden');
          mixFeedbackEl.style.display = 'inline-flex';
        } else {
          mixFeedbackEl.classList.add('hidden');
          mixFeedbackEl.style.display = 'none';
        }
      }
    }

    const btnPlayAlbum = document.getElementById('btn-play-album');
    if (btnPlayAlbum) {
      btnPlayAlbum.onclick = (e) => {
        if (e) e.stopPropagation();
        const list = album._tracks || [];
        if (!list.length) return;
        state.isRadioQueue = false;
        state.queueHistory = [];
        if (state.isShuffle) {
          state.isShuffle = false;
          localStorage.setItem('riff_shuffle', '0');
          if (el.btnShuffle) el.btnShuffle.classList.remove('active');
        }
        playTrack(list[0], list, 0, 'album');
      };
    }

    const btnShuffleAlbum = document.getElementById('btn-shuffle-album');
    if (btnShuffleAlbum) {
      btnShuffleAlbum.onclick = (e) => {
        if (e) e.stopPropagation();
        const list = album._tracks || [];
        if (!list.length) return;
        const shuffled = [...list];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        state.isRadioQueue = false;
        state.queueHistory = [];
        if (!state.isShuffle) {
          state.isShuffle = true;
          localStorage.setItem('riff_shuffle', '1');
          if (el.btnShuffle) el.btnShuffle.classList.add('active');
        }
        playTrack(shuffled[0], shuffled, 0, 'album');
      };
    }

    const handleAlbumMore = (e) => {
      openAlbumInAppMenu(e, album);
    };
    const btnAlbumMore = document.getElementById('btn-album-more');
    if (btnAlbumMore) {
      btnAlbumMore.onclick = handleAlbumMore;
    }
    const albumSide = document.querySelector('.album-side');
    if (albumSide) {
      albumSide.oncontextmenu = handleAlbumMore;
    }

    const resolvedAlbumCover = Array.isArray(album.cover)
      ? (album.cover.find(u => typeof u === 'string' && u.trim()) || '')
      : (typeof album.cover === 'string' ? album.cover.trim() : '');
    const coverEl = document.getElementById('album-detail-cover');
    if (coverEl) {
      if (album.gridCovers && Array.isArray(album.gridCovers) && album.gridCovers.length >= 4) {
        coverEl.innerHTML = `
          <div class="sp-grid-cover" style="width:100%;height:100%;aspect-ratio:1;border-radius:20px;overflow:hidden;gap:3px;padding:3px;background:var(--md-sys-color-surface-container);">
            ${album.gridCovers.slice(0, 4).map(c => `<img src="${escapeHtml(c)}" style="border-radius:8px;" />`).join('')}
          </div>
        `;
      } else {
        coverEl.innerHTML = resolvedAlbumCover
          ? `<img src="${escapeHtml(resolvedAlbumCover)}" alt="${escapeHtml(album.title)}" style="width:100%;height:100%;aspect-ratio:1;border-radius:20px;object-fit:cover;box-shadow:none;" />`
          : '<div style="width:100%;height:100%;aspect-ratio:1;border-radius:20px;background:var(--md-sys-color-surface-container);"></div>';
      }
      if (typeof bindCoverHoldZoom === 'function') bindCoverHoldZoom(coverEl);
    }

    const titleEl = document.getElementById('album-detail-title');
    if (titleEl) titleEl.textContent = album.title || 'Untitled album';

    const artistBtn = document.getElementById('album-detail-artist');
    if (artistBtn) {
      if (isDailyMix) {
        artistBtn.textContent = '';
        artistBtn.style.display = 'none';
      } else {
        artistBtn.style.display = '';
        const artistName = album.artist || '';
        renderClickableArtists(artistBtn, artistName);
        artistBtn.title = `View ${artistName}`;
      }
      artistBtn.onclick = null;
    }

    const countEl = document.getElementById('album-detail-count');
    const baseCount = album.trackCount ? `${album.trackCount} track${album.trackCount === 1 ? '' : 's'}` : '';
    const initialMeta = [album.type || 'Album', album.year, baseCount].filter(Boolean).join(' · ');
    if (countEl) countEl.textContent = initialMeta || 'Album';

    const albumHeroFx = document.getElementById('album-hero-fx');
    const firstTrackThumb = (Array.isArray(album.tracks) && album.tracks[0])
      ? ((typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(album.tracks[0]) : '') || album.tracks[0].thumbnail || album.tracks[0].cover || '')
      : '';
    const colorCover = (album.gridCovers && album.gridCovers[0]) || resolvedAlbumCover || firstTrackThumb || '';
    if (colorCover) {
      getCoverDominantColors(colorCover).then(([domColor]) => {
        if (state.currentView === 'album' && currentAlbumRunId === runId) {
          if (albumView) albumView.style.setProperty('--playlist-accent-color', domColor);
          if (albumHeroFx) albumHeroFx.style.setProperty('--playlist-accent-color', domColor);
          document.documentElement.style.setProperty('--playlist-accent-color', domColor);
        }
      });
    } else {
      if (albumView) albumView.style.removeProperty('--playlist-accent-color');
      if (albumHeroFx) albumHeroFx.style.removeProperty('--playlist-accent-color');
      document.documentElement.style.removeProperty('--playlist-accent-color');
    }

    const listEl = document.getElementById('album-tracks-list');

    const renderAlbumTracks = (tracksToRender, albumArtistToUse, albumYearToUse, resetScroll = true) => {
      if (artistBtn) {
        if (album.type === 'Daily Mix') {
          artistBtn.textContent = '';
          artistBtn.style.display = 'none';
        } else if (albumArtistToUse) {
          artistBtn.style.display = '';
          renderClickableArtists(artistBtn, albumArtistToUse);
          artistBtn.title = `View ${albumArtistToUse}`;
          artistBtn.onclick = null;
        }
      }

      if (countEl) {
        const cnt = `${tracksToRender.length} track${tracksToRender.length === 1 ? '' : 's'}`;
        countEl.textContent = [album.type || 'Album', albumYearToUse, cnt].filter(Boolean).join(' · ');
      }

      const currentCanonicalId = state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '';
      const albumTrackItems = tracksToRender.map((t, idx) => {
        const strippedTitle = typeof stripBracketTranslation === 'function' ? stripBracketTranslation(t.title || '') : (t.title || '');
        const cleanTitleNoFeat = String(strippedTitle).replace(/\s*[\(\[]\s*(?:feat\.?|ft\.?|prod\.?|featuring)[^)]*[\)\]]/gi, '').trim();
        const cleanArtistMain = String(t.artist || albumArtistToUse || album.artist || '').split(/[,;&\/]|feat\.?|ft\.?/i)[0].trim();
        return {
          id: (t.url || t.platform === 'local') ? t.id : ('alb_' + album.id + '_' + idx),
          title: strippedTitle,
          artist: t.artist || albumArtistToUse || album.artist || 'Unknown artist',
          albumArtist: albumArtistToUse || album.artist || '',
          album: album.title || '',
          duration: t.duration || Math.round((t.durationMs || 0) / 1000),
          durationMs: t.durationMs || (t.duration ? t.duration * 1000 : 0),
          cover: t.cover || t.thumbnail || resolvedAlbumCover || '',
          thumbnail: t.thumbnail || t.cover || resolvedAlbumCover || '',
          url: t.url || '',
          searchQuery: `${cleanArtistMain} ${cleanTitleNoFeat}`.trim(),
          platform: t.platform || 'ytmusic',
          no: t.no || (idx + 1),
          disc: t.disc || 1,
          isExplicit: t.isExplicit
        };
      });
      album._tracks = albumTrackItems;

      if (listEl) {
        const frag = document.createDocumentFragment();
        albumTrackItems.forEach((trackItem, idx) => {
          const row = createTrackRow(trackItem, idx, currentCanonicalId, 'album', albumTrackItems, listEl);
          row.addEventListener('click', (e) => {
            if (e.target.closest('.track-row-actions')) return;
            if (e.target.classList.contains('track-row-artist')) {
              e.stopPropagation();
              openArtistProfile(trackItem.artist, trackItem);
              return;
            }
            e.stopImmediatePropagation();
            playTrack(trackItem, albumTrackItems, idx, 'album');
          }, true);
          frag.appendChild(row);
        });
        listEl.innerHTML = '';
        listEl.appendChild(frag);
        highlightPlayingRow();
        const albumTracksCol = document.querySelector('#view-album .album-tracks-col');
        if (albumTracksCol) {
          if (resetScroll) albumTracksCol.scrollTop = 0;
          invalidateFadeCache(albumTracksCol);
          updateFade(albumTracksCol);
          if (!albumTracksCol._fadeBound) {
            albumTracksCol._fadeBound = true;
            albumTracksCol.addEventListener('scroll', () => updateFade(albumTracksCol), { passive: true });
          }
        }
      }
    };

    const albumCacheKey = 'album_tracks_' + album.id;
    const cachedAlbum = window.HomeCache && window.HomeCache.get(albumCacheKey, 24 * 3600 * 1000);

    let initialTracks = (album.tracks && Array.isArray(album.tracks) && album.tracks.length > 0)
      ? album.tracks
      : ((album._tracks && Array.isArray(album._tracks) && album._tracks.length > 0)
        ? album._tracks
        : (cachedAlbum && Array.isArray(cachedAlbum.tracks) && cachedAlbum.tracks.length > 0 ? cachedAlbum.tracks : null));

    let hasRenderedFromCache = false;
    let albumArtist = album.artist || (cachedAlbum && cachedAlbum.album && cachedAlbum.album.artist) || '';
    let albumYear = album.year || (cachedAlbum && cachedAlbum.album && cachedAlbum.album.year) || '';

    if (initialTracks) {
      if (cachedAlbum && (!album.tracks || !album.tracks.length) && (!album._tracks || !album._tracks.length)) {
        hasRenderedFromCache = true;
      }
      renderAlbumTracks(initialTracks, albumArtist, albumYear, true);
    } else if (listEl) {
      listEl.innerHTML = `<div class="m3-loader-container" style="display: flex; justify-content: center; align-items: center; padding: 64px 0; width: 100%;">
        <span class="riff-dots-loader lg" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>`;
    }

    if (!album.tracks || !album.tracks.length || hasRenderedFromCache) {
      try {
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/albums/tracks?id=${encodeURIComponent(album.id)}&title=${encodeURIComponent(album.title || '')}&artist=${encodeURIComponent(album.artist || '')}`);
        const data = await res.json();
        if (currentAlbumRunId !== runId) return;

        if (!data || !data.success || !Array.isArray(data.tracks) || data.tracks.length === 0) {
          if (!hasRenderedFromCache) {
            throw new Error(data && data.error ? data.error : 'Failed to load album tracks');
          }
          return;
        }

        if (window.HomeCache) {
          window.HomeCache.set(albumCacheKey, { tracks: data.tracks, album: data.album });
        }

        if (data.album && data.album.artist) albumArtist = data.album.artist;
        if (data.album && data.album.year) albumYear = data.album.year;

        if (hasRenderedFromCache && initialTracks) {
          const sameTracks = initialTracks.length === data.tracks.length &&
            (initialTracks.length === 0 || initialTracks[0]?.id === data.tracks[0]?.id || initialTracks[0]?.title === data.tracks[0]?.title);
          if (sameTracks) {
            return;
          }
        }

        renderAlbumTracks(data.tracks, albumArtist, albumYear, !hasRenderedFromCache);
      } catch (err) {
        if (currentAlbumRunId !== runId) return;
        if (!hasRenderedFromCache && listEl) {
          listEl.innerHTML = `<div class="empty-hint" style="color: var(--md-sys-color-error, #ba1a1a);">Failed to load album: ${escapeHtml(err.message)}</div>`;
        }
      }
    }
  }
  window.openAlbum = openAlbum;


  function getTopMomentsMap() {
    try {
      return JSON.parse(localStorage.getItem('riff_top_moments') || '{}');
    } catch (_) {
      return {};
    }
  }

  function getTopMoment(track) {
    if (!track) return null;
    const map = getTopMomentsMap();
    if (typeof track === 'string' || typeof track === 'number') {
      const v = map[String(track)];
      return (typeof v === 'number' && Number.isFinite(v)) ? v : null;
    }
    const cid = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(track) : '') || track.id;
    if (cid && typeof map[cid] === 'number') return map[cid];
    if (track.id && typeof map[track.id] === 'number') return map[track.id];
    const norm = (track.artist && track.title) ? `${track.artist.trim().toLowerCase()} - ${track.title.trim().toLowerCase()}` : '';
    if (norm && typeof map[norm] === 'number') return map[norm];
    return null;
  }

  function setTopMoment(track, timestamp) {
    if (!track || typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return;
    const map = getTopMomentsMap();
    const val = Math.max(0, Math.round(timestamp * 100) / 100);
    const cid = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(track) : '') || track.id;
    if (cid) map[cid] = val;
    if (track.id) map[track.id] = val;
    const norm = (track.artist && track.title) ? `${track.artist.trim().toLowerCase()} - ${track.title.trim().toLowerCase()}` : '';
    if (norm) map[norm] = val;
    localStorage.setItem('riff_top_moments', JSON.stringify(map));
    updateTopMomentPin();
  }

  function removeTopMoment(track) {
    if (!track) return;
    const map = getTopMomentsMap();
    const cid = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(track) : '') || track.id;
    if (cid) delete map[cid];
    if (track.id) delete map[track.id];
    const norm = (track.artist && track.title) ? `${track.artist.trim().toLowerCase()} - ${track.title.trim().toLowerCase()}` : '';
    if (norm) delete map[norm];
    localStorage.setItem('riff_top_moments', JSON.stringify(map));
    updateTopMomentPin();
  }

  function getTopMomentIconHtml() {
    const iconType = localStorage.getItem('riff_top_moment_icon') || 'heart';
    if (iconType === 'minecraft') {
      const mcSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9" shape-rendering="crispEdges" width="18" height="18" style="display:block;image-rendering:pixelated;"><rect x="2" y="0" width="1" height="1" fill="#000000"/><rect x="3" y="0" width="1" height="1" fill="#000000"/><rect x="5" y="0" width="1" height="1" fill="#000000"/><rect x="6" y="0" width="1" height="1" fill="#000000"/><rect x="1" y="1" width="1" height="1" fill="#000000"/><rect x="2" y="1" width="1" height="1" fill="#ff1313"/><rect x="3" y="1" width="1" height="1" fill="#ff1313"/><rect x="4" y="1" width="1" height="1" fill="#000000"/><rect x="5" y="1" width="1" height="1" fill="#ff1313"/><rect x="6" y="1" width="1" height="1" fill="#ff1313"/><rect x="7" y="1" width="1" height="1" fill="#000000"/><rect x="0" y="2" width="1" height="1" fill="#000000"/><rect x="1" y="2" width="1" height="1" fill="#ff1313"/><rect x="2" y="2" width="1" height="1" fill="#ffc8c8"/><rect x="3" y="2" width="1" height="1" fill="#ff1313"/><rect x="4" y="2" width="1" height="1" fill="#ff1313"/><rect x="5" y="2" width="1" height="1" fill="#ff1313"/><rect x="6" y="2" width="1" height="1" fill="#ff1313"/><rect x="7" y="2" width="1" height="1" fill="#ff1313"/><rect x="8" y="2" width="1" height="1" fill="#000000"/><rect x="0" y="3" width="1" height="1" fill="#000000"/><rect x="1" y="3" width="1" height="1" fill="#ff1313"/><rect x="2" y="3" width="1" height="1" fill="#ff1313"/><rect x="3" y="3" width="1" height="1" fill="#ff1313"/><rect x="4" y="3" width="1" height="1" fill="#ff1313"/><rect x="5" y="3" width="1" height="1" fill="#ff1313"/><rect x="6" y="3" width="1" height="1" fill="#ff1313"/><rect x="7" y="3" width="1" height="1" fill="#ff1313"/><rect x="8" y="3" width="1" height="1" fill="#000000"/><rect x="0" y="4" width="1" height="1" fill="#000000"/><rect x="1" y="4" width="1" height="1" fill="#bb1313"/><rect x="2" y="4" width="1" height="1" fill="#ff1313"/><rect x="3" y="4" width="1" height="1" fill="#ff1313"/><rect x="4" y="4" width="1" height="1" fill="#ff1313"/><rect x="5" y="4" width="1" height="1" fill="#ff1313"/><rect x="6" y="4" width="1" height="1" fill="#ff1313"/><rect x="7" y="4" width="1" height="1" fill="#bb1313"/><rect x="8" y="4" width="1" height="1" fill="#000000"/><rect x="1" y="5" width="1" height="1" fill="#000000"/><rect x="2" y="5" width="1" height="1" fill="#bb1313"/><rect x="3" y="5" width="1" height="1" fill="#ff1313"/><rect x="4" y="5" width="1" height="1" fill="#ff1313"/><rect x="5" y="5" width="1" height="1" fill="#ff1313"/><rect x="6" y="5" width="1" height="1" fill="#bb1313"/><rect x="7" y="5" width="1" height="1" fill="#000000"/><rect x="2" y="6" width="1" height="1" fill="#000000"/><rect x="3" y="6" width="1" height="1" fill="#bb1313"/><rect x="4" y="6" width="1" height="1" fill="#ff1313"/><rect x="5" y="6" width="1" height="1" fill="#bb1313"/><rect x="6" y="6" width="1" height="1" fill="#000000"/><rect x="3" y="7" width="1" height="1" fill="#000000"/><rect x="4" y="7" width="1" height="1" fill="#bb1313"/><rect x="5" y="7" width="1" height="1" fill="#000000"/><rect x="4" y="8" width="1" height="1" fill="#000000"/></svg>';
      return `<div class="top-moment-inner top-moment-mc" style="width:18px;height:18px;position:relative;background:none !important;border-radius:0 !important;mask:none !important;-webkit-mask:none !important;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">
        <div style="position:absolute;inset:0;opacity:0.42;pointer-events:none;">${mcSvg}</div>
        <div style="position:absolute;inset:0;clip-path:inset(0 calc(100% - var(--fill-pct, 0%)) 0 0);pointer-events:none;">${mcSvg}</div>
      </div>`;
    }
    let maskUrl = '';
    if (iconType === 'honey') {
      maskUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" stroke="#000" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" d="M12 3.5c-.38 0-.73.16-1 .44L6.44 8.7C4.9 10.3 4 12.44 4 14.7 4 19.12 7.58 22.7 12 22.7s8-3.58 8-8c0-2.26-.9-4.4-2.44-6l-4.56-4.76c-.27-.28-.62-.44-1-.44z"/></svg>');
    } else if (iconType === 'star') {
      maskUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" stroke="#000" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" d="m12 17.27 4.15 2.51c.76.46 1.69-.22 1.49-1.08l-1.1-4.73 3.67-3.18c.67-.58.31-1.68-.57-1.75l-4.83-.41-1.89-4.46c-.34-.81-1.5-.81-1.84 0L9.19 8.63l-4.83.41c-.88.07-1.24 1.17-.57 1.75l3.67 3.18-1.1 4.73c-.2.86.73 1.54 1.49 1.08l4.15-2.5z"/></svg>');
    } else if (iconType === 'fire') {
      maskUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" stroke="#000" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" d="M13.5 1.5s.74 2.3.74 4.17c0 1.8-.9 3.25-2.7 3.25-1.8 0-3.15-1.45-3.15-3.25l.03-.31C6.2 7.36 5 9.8 5 13c0 4.1 3.13 7.5 7 7.5s7-3.4 7-7.5c0-4.7-2.25-8.9-5.5-11.5z"/></svg>');
    } else {
      maskUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" stroke="#000" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" d="M12 20.4c-.38 0-.74-.15-1.02-.42-1.3-1.18-2.61-2.29-3.8-3.32C4.1 14.01 2 11.75 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.25-2.1 5.51-5.18 8.16-1.19 1.03-2.5 2.14-3.8 3.32-.28.27-.64.42-1.02.42z"/></svg>');
    }
    return `<div class="top-moment-inner" style="-webkit-mask-image: url('${maskUrl}'); mask-image: url('${maskUrl}'); border-radius: 6px;"></div>`;
  }

  function updateTopMomentPin() {
    const track = state.currentTrack;
    if (!track) return;
    const momentTime = getTopMoment(track);
    const dur = getReliableTrackDuration();

    ['scrubber-track', 'tvk-progress-row'].forEach(containerId => {
      const container = document.getElementById(containerId);
      if (!container) return;
      let pin = container.querySelector('.top-moment-pin');
      if (momentTime === null || dur <= 0 || momentTime > dur) {
        if (pin) {
          pin.classList.remove('visible');
          setTimeout(() => { if (pin && !pin.classList.contains('visible')) pin.style.display = 'none'; }, 240);
        }
        return;
      }
      const isNewPin = !pin;
      if (!pin) {
        pin = document.createElement('div');
        pin.className = 'top-moment-pin';
        pin.id = containerId === 'scrubber-track' ? 'top-moment-pin' : 'tvk-top-moment-pin';
        container.appendChild(pin);
      }

      const currentIconType = localStorage.getItem('riff_top_moment_icon') || 'heart';
      if (!pin.firstElementChild || pin.dataset.iconType !== currentIconType) {
        pin.innerHTML = getTopMomentIconHtml();
        pin.dataset.iconType = currentIconType;
      }

      const ratio = Math.max(0, Math.min(1, momentTime / dur));
      let targetLeft = '';
      if (containerId === 'tvk-progress-row') {
        targetLeft = `calc(10px + (100% - 20px) * ${ratio.toFixed(4)})`;
      } else {
        targetLeft = `calc(5.5px + (100% - 11px) * ${ratio.toFixed(4)})`;
      }

      const wasVisible = !isNewPin && pin.classList.contains('visible');
      pin.style.display = 'flex';

      if (!wasVisible) {
        pin.style.transition = 'none';
        pin.style.left = targetLeft;
        void pin.offsetWidth;
        pin.style.transition = '';
        requestAnimationFrame(() => pin.classList.add('visible'));
      } else {
        pin.classList.add('visible');
        pin.style.left = targetLeft;
      }

      pin.title = `${typeof t === 'function' ? t('Top moment') : 'Top moment'}: ${formatDuration(momentTime)} (click to jump, right click to remove)`;

      pin.onclick = (e) => {
        e.stopPropagation();
        if (el.nativeAudio && Number.isFinite(momentTime)) {
          el.nativeAudio.currentTime = momentTime;
          updateMediaPositionState();
        }
      };
      pin.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeTopMoment(track);
        showToast(typeof t === 'function' ? t('Top moment removed') : 'Top moment removed');
      };
    });
  }


  function formatCount(num) {
    if (!num || isNaN(num) || num <= 0) return '';
    const lang = localStorage.getItem('riff_ui_lang') || 'en';
    try {
      return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(num);
    } catch (e) {
      if (num >= 1000000) {
        const v = (num / 1000000).toFixed(1);
        return (v.endsWith('.0') ? v.slice(0, -2) : v) + 'M';
      }
      if (num >= 1000) return Math.round(num / 1000) + 'K';
      return String(num);
    }
  }

var MULTI_ARTIST_EXCEPTIONS = new Set([
  'simon & garfunkel', 'hall & oates', 'brooks & dunn', 'tegan and sara',
  'earth, wind & fire', 'crosby, stills & nash', 'crosby, stills, nash & young',
  'mumford & sons', 'florence + the machine', 'florence & the machine',
  'belle & sebastian', 'belle and sebastian', 'emerson, lake & palmer',
  'kc & the sunshine band', 'kool & the gang', 'sly & the family stone',
  'echo & the bunnymen', 'coheed and cambria', 'angus & julia stone',
  'above & beyond', 'chase & status', 'gnarls barkley',
  'twenty one pilots', 'ac/dc', 't.a.t.u.', 'tylerthecreator', 'tyler, the creator'
]);
var FEAT_BRACKET_RE = new RegExp('\\s*[\\(\\[]\\s*(?:feat\\.?|ft\\.?|featuring|prod\\.?\\s*by)\\s+([^\\)\\]]+)[\\)\\]]', 'gi');
var ARTIST_SEP_RE = new RegExp('(\\s+(?:feat\\.?|ft\\.?|featuring|with|vs\\.?|\\u00d7|x)\\s+|\\s*(?:&|,|;|\\/|\\+)\\s*)', 'gi');

function splitArtistTokens(rawArtist) {
  rawArtist = stripYoutubeTopic(rawArtist);
  const str = String(rawArtist || '').trim();
  if (!str) return [{ type: 'artist', value: 'Unknown artist' }];
  if (MULTI_ARTIST_EXCEPTIONS.has(str.toLowerCase())) return [{ type: 'artist', value: str }];
  const cleanStr = str.replace(FEAT_BRACKET_RE, ' feat. $1');
  const parts = cleanStr.split(ARTIST_SEP_RE).filter(Boolean);
  if (parts.length <= 1) return [{ type: 'artist', value: str }];
  const tokens = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    ARTIST_SEP_RE.lastIndex = 0;
    if (ARTIST_SEP_RE.test(p)) {
      ARTIST_SEP_RE.lastIndex = 0;
      tokens.push({ type: 'sep', value: p });
    } else {
      const trimmed = p.trim();
      if (trimmed) tokens.push({ type: 'artist', value: trimmed });
    }
  }
  return tokens.length ? tokens : [{ type: 'artist', value: str }];
}

function renderClickableArtists(container, rawArtist, hintTrack = null) {
  rawArtist = stripYoutubeTopic(rawArtist);
  if (!container) return;
  container.innerHTML = '';
  const isLocal = Boolean(hintTrack && (hintTrack.platform === 'local' || hintTrack.source === 'local' || String(hintTrack.id || '').startsWith('local_') || String(hintTrack.url || '').startsWith('file:')));
  splitArtistTokens(rawArtist).forEach((tok) => {
    if (tok.type === 'sep') {
      const sep = document.createElement('span');
      sep.className = 'artist-sep';
      sep.textContent = tok.value;
      container.appendChild(sep);
    } else if (isLocal) {
      const span = document.createElement('span');
      span.className = 'artist-link-part is-local-artist';
      span.textContent = tok.value;
      container.appendChild(span);
    } else {
      const span = document.createElement('span');
      span.className = 'artist-link-part';
      span.textContent = tok.value;
      span.dataset.artist = tok.value;
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        if (tok.value && tok.value.toLowerCase() !== 'unknown artist') {
          if (el.tvKaraoke && !el.tvKaraoke.classList.contains('hidden') && typeof closeTvKaraoke === 'function') closeTvKaraoke();
          openArtistProfile(tok.value, hintTrack || state.currentTrack);
        }
      });
      container.appendChild(span);
    }
  });
}

  var favArtistsCurrentList = [];

  function isArtistFollowed(artistName) {
    if (!artistName) return false;
    const lower = artistName.trim().toLowerCase();
    const favs = safeArray('riff_favorite_artists');
    return favs.some(x => (typeof x === 'string' ? x : x.name || '').toLowerCase().trim() === lower);
  }

  function getFavoriteArtistsList() {
    const favsRaw = safeArray('riff_favorite_artists');
    if (!favsRaw || favsRaw.length === 0) return [];

    const unfollowedList = safeArray('riff_unfollowed_artists');
    const unfollowed = new Set(unfollowedList.map(a => (typeof a === 'string' ? a : a.name || '').toLowerCase().trim()));
    const metaCache = safeJson('riff_artist_meta_cache', {});

    const result = [];
    const seen = new Set();

    favsRaw.forEach(item => {
      const name = (typeof item === 'string' ? item : item.name || '').trim();
      if (!name) return;
      const lower = name.toLowerCase();
      if (unfollowed.has(lower) || seen.has(lower)) return;
      seen.add(lower);

      const cached = metaCache[lower] || {};
      result.push({
        name: name,
        avatar: (typeof item === 'object' && item.avatar) || cached.avatar || '',
        fans: (typeof item === 'object' && item.fans) || cached.fans || 0,
        plays: (typeof item === 'object' && item.plays) || 0,
        followed: true
      });
    });

    return result;
  }

  function toggleFollowArtist(artistName, meta = {}) {
    if (!artistName || !artistName.trim()) return false;
    const cleanName = artistName.trim();
    const lower = cleanName.toLowerCase();

    let favs = safeArray('riff_favorite_artists');
    let unfollowed = safeArray('riff_unfollowed_artists');
    const metaCache = safeJson('riff_artist_meta_cache', {});

    const isFav = favs.some(x => (typeof x === 'string' ? x : x.name || '').toLowerCase().trim() === lower);

    if (isFav) {
      favs = favs.filter(x => (typeof x === 'string' ? x : x.name || '').toLowerCase().trim() !== lower);
      if (!unfollowed.some(x => (typeof x === 'string' ? x : x.name || '').toLowerCase().trim() === lower)) {
        unfollowed.push(cleanName);
      }
    } else {
      unfollowed = unfollowed.filter(x => (typeof x === 'string' ? x : x.name || '').toLowerCase().trim() !== lower);
      const existingObj = favs.find(x => (typeof x === 'string' ? x : x.name || '').toLowerCase().trim() === lower);
      const obj = (typeof existingObj === 'object' && existingObj) ? existingObj : {
        name: cleanName,
        avatar: meta.avatar || metaCache[lower]?.avatar || '',
        fans: meta.fans || metaCache[lower]?.fans || 0
      };
      if (meta.avatar) obj.avatar = meta.avatar;
      if (meta.fans) obj.fans = meta.fans;
      favs.push(obj);
    }

    if (meta && (meta.avatar || meta.fans)) {
      metaCache[lower] = { ...(metaCache[lower] || {}), ...meta };
      localStorage.setItem('riff_artist_meta_cache', JSON.stringify(metaCache));
    }

    localStorage.setItem('riff_favorite_artists', JSON.stringify(favs));
    localStorage.setItem('riff_unfollowed_artists', JSON.stringify(unfollowed));

    const followed = !isFav;
    const btnFollow = document.getElementById('btn-artist-follow');
    const profName = document.getElementById('artist-profile-name');
    if (btnFollow && profName && profName.textContent.trim().toLowerCase() === lower) {
      btnFollow.classList.toggle('active', followed);
      btnFollow.classList.toggle('following', followed);
      btnFollow.innerHTML = followed
        ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>'
        : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
      btnFollow.title = followed ? 'Following' : 'Follow';
      btnFollow.setAttribute('aria-label', followed ? 'Following' : 'Follow');
    }

    if (typeof renderSpotifyHome === 'function') renderSpotifyHome();
    if (homeMode === 'artists' && typeof renderHomeCarousel === 'function') renderHomeCarousel('artists');

    return followed;
  }

  function fetchFavArtistMeta(artistObj, card) {
    if (!artistObj || !artistObj.name) return Promise.resolve();
    const lower = (artistObj.name || '').toLowerCase();
    return fetch(`http://127.0.0.1:${state.serverPort}/api/artist?name=${encodeURIComponent(artistObj.name)}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.success && data.artist) {
          const newAvatar = data.artist.avatar || data.artist.banner || '';
          const newFans = data.artist.fans || data.artist.nb_fan || 0;
          if (newAvatar) {
            if (card) {
              const img = card.querySelector('.fav-artist-img');
              if (img) img.src = newAvatar;
            }
            artistObj.avatar = newAvatar;
          }
          if (newFans) {
            artistObj.fans = newFans;
            if (!artistObj.plays || artistObj.plays <= 0) {
              if (card) {
                const badgeSpan = card.querySelector('.fav-artist-plays span');
                if (badgeSpan) badgeSpan.textContent = `${formatCount(newFans)} listeners`;
              }
            }
          }
          const cache = safeJson('riff_artist_meta_cache', {});
          cache[lower] = {
            avatar: artistObj.avatar || '',
            fans: artistObj.fans || 0,
            plays: artistObj.plays || 0
          };
          localStorage.setItem('riff_artist_meta_cache', JSON.stringify(cache));
        }
      })
      .catch(() => {});
  }

  function buildFavArtistCircleCard(artistObj, forCarousel = false, idx = 0, autoFetch = true) {
    const card = document.createElement('div');
    if (forCarousel) {
      card.className = 'my-wave-track-card fav-artist-carousel-card';
      if (typeof idx === 'number') card.dataset.index = String(idx);
    } else {
      card.className = 'fav-artist-card';
    }

    const metaCache = safeJson('riff_artist_meta_cache', {});
    const lower = (artistObj.name || '').toLowerCase();
    const cached = metaCache[lower];

    let avatar = artistObj.avatar || (cached && cached.avatar) || '';
    let fans = artistObj.fans || (cached && cached.fans) || 0;
    let plays = artistObj.plays || (cached && cached.plays) || 0;
    artistObj.avatar = avatar;
    artistObj.fans = fans;
    artistObj.plays = plays;

    const playText = plays > 0
      ? `${formatCount(plays)} play${plays === 1 ? '' : 's'}`
      : (fans > 0 ? `${formatCount(fans)} listeners` : '0 plays');

    const circleHtml = `
      <div class="fav-artist-circle">
        <img class="fav-artist-img" src="${escapeHtml(avatar)}" alt="${escapeHtml(artistObj.name)}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'152\\' height=\\'152\\' fill=\\'%23333\\'><circle cx=\\'76\\' cy=\\'76\\' r=\\'76\\' fill=\\'%232a2a2a\\'/></svg>'">
        <div class="fav-artist-plays"><svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4"/></svg><span>${escapeHtml(playText)}</span></div>
        <div class="fav-artist-hover">
          <button type="button" class="fav-artist-action-btn primary btn-play-fav" title="Play ${escapeHtml(artistObj.name)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>Play</span>
          </button>
          <button type="button" class="fav-artist-action-btn btn-view-fav" title="View profile">Profile</button>
        </div>
      </div>
    `;

    if (forCarousel) {
      card.innerHTML = circleHtml;
    } else {
      card.innerHTML = `
        ${circleHtml}
        <div class="fav-artist-name" title="${escapeHtml(artistObj.name)}">${escapeHtml(artistObj.name)}</div>
      `;
    }

    if (autoFetch && (!avatar || !fans)) {
      fetchFavArtistMeta(artistObj, card);
    }

    const btnPlay = card.querySelector('.btn-play-fav');
    if (btnPlay) {
      btnPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        openArtistProfile(artistObj.name).then(() => {
          const btnPlayTracks = document.getElementById('btn-play-artist-tracks');
          if (btnPlayTracks) btnPlayTracks.click();
        }).catch(() => {});
      });
    }

    const btnView = card.querySelector('.btn-view-fav');
    if (btnView) {
      btnView.addEventListener('click', (e) => {
        e.stopPropagation();
        openArtistProfile(artistObj.name);
      });
    }

    const nameEl = card.querySelector('.fav-artist-name');
    if (nameEl) {
      nameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openArtistProfile(artistObj.name);
      });
    }

    if (forCarousel) {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.fav-artist-hover')) return;
        const row = document.getElementById('home-vibe-grid');
        const focusedIndex = (row && typeof row._focusedIndex === 'number') ? row._focusedIndex : 0;
        if (idx === focusedIndex) {
          openArtistProfile(artistObj.name);
        } else if (row) {
          scrollCarouselTo(row, idx);
        }
      });
    } else {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.fav-artist-hover')) return;
        openArtistProfile(artistObj.name);
      });
    }

    return card;
  }

  function renderM3Loader(container) {
    if (!container) return;
    container.innerHTML = `
      <div class="m3-loader-container" style="display:flex;justify-content:center;align-items:center;padding:48px 0;width:100%;">
        <span class="riff-dots-loader lg" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>
    `;
  }

  var currentArtistCatType = null;

  function ensureArtistTableHead(container) {
    if (!container || !container.parentElement) return;
    let tableHead = container.parentElement.querySelector(':scope > .artist-tracks-table-head');
    if (!tableHead) {
      tableHead = document.createElement('div');
      tableHead.className = 'sp-tracks-table-head artist-tracks-table-head';
      tableHead.innerHTML = `
        <span class="sp-th-num">#</span>
        <span></span>
        <span class="sp-th-title" data-i18n>Title</span>
        <span class="sp-th-album" data-i18n>Album</span>
        <span class="sp-th-plays" data-i18n-fixed title="Plays">▶</span>
        <span></span>
        <span class="sp-th-dur">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </span>
      `;
      container.parentElement.insertBefore(tableHead, container);
    }
  }

  function renderArtistAlbumCards(container, albums, cleanName) {
    if (!container) return;
    if (!albums || albums.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = albums.map(alb => {
      const sub = alb.year ? `${escapeHtml(alb.artist || cleanName)} · ${escapeHtml(alb.year)}` : escapeHtml(alb.artist || cleanName);
      return `
        <div class="search-album-card" role="button" tabindex="0" title="${escapeHtml(alb.title || '')}">
          <div class="search-album-cover-box">${alb.cover ? `<img class="search-album-cover" src="${escapeHtml(alb.cover)}" alt="${escapeHtml(alb.title || '')}" loading="lazy" onerror="this.style.display='none'" />` : '<div class="search-album-cover" style="display:flex;align-items:center;justify-content:center;background:var(--md-sys-color-surface-container-high);"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--md-sys-color-outline);"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>'}</div>
          <div class="search-album-info">
            <span class="search-album-title" title="${escapeHtml(alb.title || '')}">${escapeHtml(alb.title || '')}</span>
            <span class="search-album-sub" title="${sub}">${sub}</span>
          </div>
        </div>
      `;
    }).join('');

    const cards = container.querySelectorAll('.search-album-card');
    cards.forEach((card, idx) => {
      const alb = albums[idx];
      if (!alb) return;
      card.addEventListener('click', () => openAlbum(alb));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          openAlbum(alb);
        }
      });
    });
    bindHorizontalWheel(container);
  }

  function closeArtistCategory() {
    currentArtistCatType = null;
    const catDetail = document.getElementById('artist-category-detail');
    const mainContent = document.getElementById('artist-main-content');
    if (catDetail) catDetail.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('hidden');
  }

  function openArtistCategory(type, artistData) {
    const data = artistData || state.currentArtistData;
    if (!data) return;
    const catDetail = document.getElementById('artist-category-detail');
    const mainContent = document.getElementById('artist-main-content');
    const catTitle = document.getElementById('artist-category-title');
    const catSub = document.getElementById('artist-category-sub');
    const catTracksList = document.getElementById('artist-cat-tracks-list');
    const catAlbumsGrid = document.getElementById('artist-cat-albums-grid');

    if (!catDetail || !mainContent) return;
    currentArtistCatType = type;

    mainContent.classList.add('hidden');
    catDetail.classList.remove('hidden');

    const cleanName = data.name || state.currentArtist || 'Artist';
    const lang = localStorage.getItem('riff_ui_lang') || 'en';

    if (type === 'albums') {
      if (catTitle) catTitle.textContent = lang === 'ru' ? 'Альбомы' : (t('Albums') || 'Albums');
      const validAlbums = (Array.isArray(data.albums) ? data.albums : [])
        .filter(a => a && a.title && a.artist && a.artist.toLowerCase().trim() === cleanName.toLowerCase().trim())
        .filter(a => (a.trackCount === undefined || a.trackCount === 0 || a.trackCount > 1) && a.recordType !== 'single');
      const albSuffix = lang === 'ru' ? 'альбомов' : 'albums';
      if (catSub) catSub.textContent = `${validAlbums.length} ${albSuffix} · ${cleanName}`;
      if (catTracksList) catTracksList.classList.add('hidden');
      if (catAlbumsGrid) {
        catAlbumsGrid.classList.remove('hidden');
        renderArtistAlbumCards(catAlbumsGrid, validAlbums, cleanName);
      }
    } else if (type === 'popular') {
      if (catTitle) catTitle.textContent = lang === 'ru' ? 'Популярные треки' : (t('Popular songs') || 'Popular songs');
      const tracks = data.tracks || [];
      if (catSub) catSub.textContent = cleanName;
      if (catAlbumsGrid) catAlbumsGrid.classList.add('hidden');
      if (catTracksList) {
        catTracksList.classList.remove('hidden');
        ensureArtistTableHead(catTracksList);
        renderTracks(catTracksList, tracks, 'artist');
      }
    } else {  
      if (catTitle) catTitle.textContent = lang === 'ru' ? 'Все треки' : (t('All tracks') || 'All tracks');
      const tracks = data.tracks || [];
      const trkSuffix = lang === 'ru' ? 'треков' : 'tracks';
      if (catSub) catSub.textContent = `${tracks.length} ${trkSuffix} · ${cleanName}`;
      if (catAlbumsGrid) catAlbumsGrid.classList.add('hidden');
      if (catTracksList) {
        catTracksList.classList.remove('hidden');
        ensureArtistTableHead(catTracksList);
        renderTracks(catTracksList, tracks, 'artist');
      }
    }

    const scrollParent = document.querySelector('.main-content');
    if (scrollParent) scrollParent.scrollTop = 0;
  }

  var artistSearchQuery = '';
  var artistSortMode = 'popular';

  function getArtistTrackPlaysCount(t) {
    if (!t) return 0;
    const cleanTitle = (t.title || '').replace(/\[.*?\]|\(.*?\)/g, '').replace(/official\s*(music)?\s*video|official\s*audio|lyrics|hd|4k|remastered|visualizer/gi, '').trim().toLowerCase();
    const cleanArtist = (t.artist || '').replace(/\[.*?\]|\(.*?\)/g, '').replace(/- topic|vevo|records|official/gi, '').trim().toLowerCase();
    const cached = Number(
      globalPlayCountCache.get(cleanArtist + ':::' + cleanTitle) ||
      globalPlayCountCache.get(((t.artist || '') + ':::' + (t.title || '')).toLowerCase().trim()) ||
      0
    );
    const direct = Number(t.playCount || t.plays || t.listeners || 0);
    const fromTxt = (t.playsText || t.listenersText) ? (parseInt(String(t.playsText || t.listenersText).replace(/[^\d]/g, ''), 10) || 0) : 0;
    return Math.max(cached, direct, fromTxt);
  }

  function sortAndFilterArtistTracks(rawTracks, mode = artistSortMode, query = artistSearchQuery) {
    if (!Array.isArray(rawTracks)) return [];
    let list = [...rawTracks];
    const q = String(query || '').trim().toLowerCase();
    if (q) {
      list = list.filter(t =>
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.artist && t.artist.toLowerCase().includes(q)) ||
        (t.album && t.album.toLowerCase().includes(q))
      );
    }
    if (mode === 'title-asc') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (mode === 'duration-desc') {
      list.sort((a, b) => (Number(b.duration) || 0) - (Number(a.duration) || 0));
    } else if (mode === 'duration-asc') {
      list.sort((a, b) => (Number(a.duration) || 0) - (Number(b.duration) || 0));
    } else {
      list.sort((a, b) => getArtistTrackPlaysCount(b) - getArtistTrackPlaysCount(a));
    }
    return list;
  }

  function refreshArtistTracksView() {
    const artistData = state.currentArtistData;
    if (!artistData) return;
    const allTracks = artistData.tracks || [];
    const sortedAll = sortAndFilterArtistTracks(allTracks, artistSortMode, artistSearchQuery);
    const popularSorted = sortAndFilterArtistTracks(allTracks, 'popular', artistSearchQuery).slice(0, 5);

    const popularList = document.getElementById('artist-popular-tracks-list');
    if (popularList && allTracks.length > 0) {
      renderArtistPopularTracks(popularList, popularSorted);
    }
    const allTracksList = document.getElementById('artist-all-tracks-list');
    if (allTracksList && allTracks.length > 0) {
      renderTracks(allTracksList, sortedAll, 'artist');
    }
    const catTracksList = document.getElementById('artist-cat-tracks-list');
    if (catTracksList && currentArtistCatType && currentArtistCatType !== 'albums') {
      renderTracks(catTracksList, sortedAll, 'artist');
    }
  }

  function ensureArtistSearchSortToolbar() {
    const mainContent = document.getElementById('artist-main-content');
    const secPopular = document.getElementById('artist-section-popular');
    if (!mainContent || !secPopular) return;
    let bar = document.getElementById('artist-tracks-toolbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'artist-tracks-toolbar';
      bar.className = 'playlist-table-toolbar artist-tracks-toolbar';
      bar.style.cssText = 'padding: 8px 32px 0 32px; margin-bottom: 0; justify-content: flex-end; gap: 6px;';
      bar.innerHTML = `
        <button class="btn-icon-pill sp-quiet-icon-btn" id="btn-toggle-artist-search" type="button" title="Search in artist tracks" aria-label="Search in artist tracks">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <div class="view-search-box" id="artist-search-box">
          <input type="text" id="artist-search-input" class="view-search-input" placeholder="${escapeHtml(t('Search in playlist...'))}" autocomplete="off">
        </div>
        <div class="m3-dropdown" id="artist-sort-dropdown" style="width: auto; flex-shrink: 0;">
          <button class="m3-dropdown-trigger sp-quiet-icon-btn" id="artist-sort-trigger" type="button" title="Sort" aria-label="Sort">
            <span class="m3-dropdown-label" id="artist-sort-label" style="display:none;">Popular</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="13" y2="6"/><line x1="4" y1="12" x2="11" y2="12"/><line x1="4" y1="18" x2="11" y2="18"/><polyline points="15 15 18 18 21 15"/><line x1="18" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div class="m3-dropdown-menu" id="artist-sort-menu" style="right: 0; left: auto; width: 190px;">
            <button class="m3-dropdown-option selected" data-value="popular" type="button">${escapeHtml(t('Popular Songs'))}</button>
            <button class="m3-dropdown-option" data-value="title-asc" type="button">Title (A–Z)</button>
            <button class="m3-dropdown-option" data-value="duration-desc" type="button">Duration (longest)</button>
            <button class="m3-dropdown-option" data-value="duration-asc" type="button">Duration (shortest)</button>
          </div>
        </div>
      `;
      mainContent.insertBefore(bar, secPopular);

      const btnSearch = bar.querySelector('#btn-toggle-artist-search');
      const searchBox = bar.querySelector('#artist-search-box');
      const searchInput = bar.querySelector('#artist-search-input');
      const sortDropdown = bar.querySelector('#artist-sort-dropdown');
      const sortTrigger = bar.querySelector('#artist-sort-trigger');
      const sortMenu = bar.querySelector('#artist-sort-menu');

      if (btnSearch && searchBox && searchInput) {
        btnSearch.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = searchBox.classList.toggle('open');
          if (isOpen) {
            searchInput.focus();
          } else {
            searchInput.value = '';
            artistSearchQuery = '';
            refreshArtistTracksView();
          }
        });
        searchInput.addEventListener('input', () => {
          artistSearchQuery = searchInput.value;
          refreshArtistTracksView();
        });
        searchInput.addEventListener('blur', () => {
          if (!searchInput.value.trim()) searchBox.classList.remove('open');
        });
      }

      if (sortDropdown && sortTrigger && sortMenu) {
        sortTrigger.addEventListener('click', (e) => {
          e.stopPropagation();
          sortDropdown.classList.toggle('open');
        });
        document.addEventListener('click', () => sortDropdown.classList.remove('open'));
        sortMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
          opt.addEventListener('click', (e) => {
            e.stopPropagation();
            artistSortMode = opt.dataset.value || 'popular';
            sortMenu.querySelectorAll('.m3-dropdown-option').forEach(o => o.classList.toggle('selected', o === opt));
            sortDropdown.classList.remove('open');
            refreshArtistTracksView();
          });
        });
      }
    }
  }

  function renderArtistPopularTracks(container, tracks) {
    if (!container) return;
    container.innerHTML = '';
    if (!tracks || tracks.length === 0) return;
    const sorted = [...tracks].sort((a, b) => getArtistTrackPlaysCount(b) - getArtistTrackPlaysCount(a));
    const currentCanonicalId = state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '';
    const fragment = document.createDocumentFragment();
    for (let idx = 0; idx < sorted.length; idx++) {
      const row = createTrackRow(sorted[idx], idx, currentCanonicalId, 'artist', sorted, container);
      row.style.setProperty('--row-idx', String(idx));
      fragment.appendChild(row);
    }
    container.appendChild(fragment);
    highlightPlayingRow();
    if (typeof refreshOverflowFades === 'function') refreshOverflowFades(container);
  }

  function applyArtistDataToUI(artistData, cleanName, myArtistToken) {
    if (state.artistLoadToken !== myArtistToken) return;
    state.currentArtistData = artistData;

    const hero = document.getElementById('artist-hero');
    const btnBioModal = document.getElementById('btn-artist-bio-modal');
    const btnFollow = document.getElementById('btn-artist-follow');
    const btnBlock = document.getElementById('btn-artist-block');

    if (el.artistProfileName) el.artistProfileName.textContent = artistData.name || cleanName;

     
    if (btnFollow) {
      const isFollowed = isArtistFollowed(cleanName);
      btnFollow.classList.toggle('active', isFollowed);
      btnFollow.classList.toggle('following', isFollowed);
      btnFollow.innerHTML = isFollowed
        ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>'
        : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
      btnFollow.title = isFollowed ? 'Following' : 'Follow';
      btnFollow.setAttribute('aria-label', isFollowed ? 'Following' : 'Follow');
      btnFollow.onclick = () => {
        const meta = {
          avatar: (artistData && (artistData.avatar || artistData.banner)) || '',
          fans: (artistData && (artistData.fans || artistData.nb_fan)) || 0
        };
        const nowFollowed = toggleFollowArtist(cleanName, meta);
        btnFollow.classList.toggle('active', nowFollowed);
        btnFollow.classList.toggle('following', nowFollowed);
        btnFollow.innerHTML = nowFollowed
          ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>'
          : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
        btnFollow.title = nowFollowed ? 'Following' : 'Follow';
        btnFollow.setAttribute('aria-label', nowFollowed ? 'Following' : 'Follow');
        showToast(nowFollowed ? `Following ${cleanName}` : `Unfollowed ${cleanName}`, 'info');
      };
    }

     
    if (btnBlock) {
      const isBlocked = isArtistBlocked(cleanName);
      btnBlock.classList.toggle('active', isBlocked);
      btnBlock.classList.toggle('blocked', isBlocked);
      btnBlock.title = isBlocked ? 'Blocked' : 'Block artist';
      btnBlock.setAttribute('aria-label', isBlocked ? 'Blocked' : 'Block artist');
      btnBlock.onclick = () => {
        const nowBlocked = toggleBlockArtist(cleanName);
        btnBlock.classList.toggle('active', nowBlocked);
        btnBlock.classList.toggle('blocked', nowBlocked);
        btnBlock.title = nowBlocked ? 'Blocked' : 'Block artist';
        btnBlock.setAttribute('aria-label', nowBlocked ? 'Blocked' : 'Block artist');
      };
    }

     
    const bioCacheKey = cleanName.toLowerCase();
    const rawBio = (artistData && artistData.bio) ? artistData.bio : '';
    const cleanBio = rawBio.replace(/<[^>]*>/g, '').trim();
    if (cleanBio) {
      artistBioCache.set(bioCacheKey, cleanBio);
      boundMap(artistBioCache, 20);
      if (el.artistProfileBio) el.artistProfileBio.textContent = cleanBio;
      if (btnBioModal) btnBioModal.classList.remove('hidden');
    } else {
      artistBioCache.set(bioCacheKey, '');
      boundMap(artistBioCache, 20);
      if (el.artistProfileBio) {
        el.artistProfileBio.textContent = '';
        el.artistProfileBio.classList.remove('fade-end');
      }
      if (btnBioModal) btnBioModal.classList.add('hidden');
    }

     
    if (el.artistVerifiedBadge) el.artistVerifiedBadge.classList.toggle('hidden', !artistData.isVerified);

     
    const fans = artistData.fans || artistData.nb_fan || 0;
    let numListeners = 0;
    if (artistData.monthlyListeners) {
      const digits = String(artistData.monthlyListeners).replace(/[^\d]/g, '');
      if (digits) numListeners = parseInt(digits, 10);
    }
    if (!numListeners) numListeners = Number(fans || 0);
    if (el.artistFansLine) {
      if (numListeners > 0) {
        const lang = localStorage.getItem('riff_ui_lang') || 'en';
        const formattedCount = formatCount(numListeners);
        const isMonthly = Boolean(artistData.monthlyListeners);
        const suffix = lang === 'ru'
          ? (isMonthly ? 'слушателей в месяц' : 'слушателей')
          : (isMonthly ? 'monthly listeners' : 'listeners');
        el.artistFansLine.textContent = `${formattedCount} ${suffix}`;
        el.artistFansLine.style.display = 'block';
      } else {
        el.artistFansLine.textContent = '';
        el.artistFansLine.style.display = 'none';
      }
    }

     
    const rawBanners = Array.isArray(artistData.banners) && artistData.banners.length > 0
      ? artistData.banners
      : [artistData.banner || artistData.avatar].filter(Boolean);
    const banners = [];
    const seenNorm = new Set();
    for (const u of rawBanners) {
      const s = String(u || '').trim();
      if (!s) continue;
      const key = s.split('?')[0].toLowerCase();
      if (seenNorm.has(key)) continue;
      seenNorm.add(key);
      banners.push(s);
    }
    const avatar = artistData.avatar || '';

    if (hero) {
      hero.querySelectorAll('.artist-banner-carousel, .artist-banner-controls, .artist-banner-dots, .artist-banner-nav').forEach(n => n.remove());
    }

    const updateAccentFromBanner = (bannerUrl) => {
      if (!bannerUrl) return;
      if (typeof getCoverBaseColor === 'function') {
        getCoverBaseColor(bannerUrl).then(info => {
          const isLight = info && info.lum > 0.6;
          if (hero) {
            hero.style.setProperty('--artist-fg', isLight ? '#121214' : '#ffffff');
            hero.style.setProperty('--artist-fg-bg', isLight ? '#ffffff' : '#000000');
          }
        }).catch(() => {});
      }
      if (typeof getCoverDominantColors === 'function') {
        getCoverDominantColors(bannerUrl).then(([domColor]) => {
          if (state.currentView === 'artist' && hero) {
            const c = domColor || 'var(--md-sys-color-primary-container)';
            hero.style.setProperty('--artist-accent-color', c);
            document.documentElement.style.setProperty('--artist-accent-color', c);
          }
        }).catch(() => {});
      }
    };

    if (banners.length > 1 && hero) {
      if (el.artistHeroImg) el.artistHeroImg.style.display = 'none';

      const carouselEl = document.createElement('div');
      carouselEl.className = 'artist-banner-carousel';
      carouselEl.innerHTML = `
        <div class="artist-banner-track">
          ${banners.map(u => `<img class="artist-banner-slide" src="${escapeHtml(u)}" alt="" draggable="false" />`).join('')}
        </div>
        <div class="artist-banner-controls">
          <button type="button" class="artist-banner-nav prev" aria-label="Previous photo">&lsaquo;</button>
          <div class="artist-banner-dots">
            ${banners.map((_, i) => `<span class="artist-banner-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></span>`).join('')}
          </div>
          <button type="button" class="artist-banner-nav next" aria-label="Next photo">&rsaquo;</button>
        </div>
      `;
      hero.insertBefore(carouselEl, hero.firstChild);

      const trackEl = carouselEl.querySelector('.artist-banner-track');
      const dots = carouselEl.querySelectorAll('.artist-banner-dot');
      let curIdx = 0;

      const goToSlide = (idx) => {
        curIdx = (idx + banners.length) % banners.length;
        if (trackEl) trackEl.style.transform = `translate3d(-${curIdx * 100}%, 0, 0)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === curIdx));
        updateAccentFromBanner(banners[curIdx]);
      };

      carouselEl.querySelector('.artist-banner-nav.prev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSlide(curIdx - 1);
      });
      carouselEl.querySelector('.artist-banner-nav.next')?.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSlide(curIdx + 1);
      });
      dots.forEach((dot) => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const target = parseInt(dot.dataset.idx || dot.dataset.index, 10);
          if (!Number.isNaN(target)) goToSlide(target);
        });
      });

      let pStartX = 0;
      let pStartY = 0;
      let isPointerDown = false;
      hero.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.btn-back-artist, .artist-action-buttons, .artist-banner-controls, .artist-banner-nav, .artist-banner-dots')) return;
        isPointerDown = true;
        pStartX = e.clientX;
        pStartY = e.clientY;
      });
      hero.addEventListener('pointerup', (e) => {
        if (!isPointerDown) return;
        isPointerDown = false;
        const diffX = e.clientX - pStartX;
        const diffY = e.clientY - pStartY;
        if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX < 0) goToSlide(curIdx + 1);
          else goToSlide(curIdx - 1);
        }
      });
      hero.addEventListener('pointercancel', () => { isPointerDown = false; });

      updateAccentFromBanner(banners[0]);
    } else {
      const banner = banners[0] || '';
      if (el.artistHeroImg) {
        if (banner) {
          el.artistHeroImg.style.opacity = '0';
          el.artistHeroImg.style.display = 'block';
          el.artistHeroImg.onload = () => {
            if (state.artistLoadToken === myArtistToken) el.artistHeroImg.style.opacity = '1';
          };
          el.artistHeroImg.onerror = () => {
            if (state.artistLoadToken !== myArtistToken) return;
            if (avatar && el.artistHeroImg.src !== avatar) {
              el.artistHeroImg.src = avatar;
            } else {
              el.artistHeroImg.style.display = 'none';
            }
          };
          el.artistHeroImg.src = banner;
        } else {
          el.artistHeroImg.onload = null;
          el.artistHeroImg.onerror = null;
          el.artistHeroImg.removeAttribute('src');
          el.artistHeroImg.style.opacity = '0';
          el.artistHeroImg.style.display = 'none';
        }
      }
      if (banner || avatar) {
        updateAccentFromBanner(banner || avatar);
      } else if (hero) {
        hero.style.setProperty('--artist-accent-color', 'var(--md-sys-color-primary-container)');
      }
    }

     
    const lower = cleanName.toLowerCase();
    const metaCache = safeJson('riff_artist_meta_cache', {});
    metaCache[lower] = {
      avatar: artistData.avatar || artistData.banner || (metaCache[lower] && metaCache[lower].avatar) || '',
      fans: artistData.fans || artistData.nb_fan || (metaCache[lower] && metaCache[lower].fans) || 0,
      plays: (metaCache[lower] && metaCache[lower].plays) || 0
    };
    localStorage.setItem('riff_artist_meta_cache', JSON.stringify(metaCache));

    const allTracks = (artistData.tracks || []).map(tr => {
      if (tr && tr.title && typeof stripBracketTranslation === 'function') {
        const cleanT = stripBracketTranslation(tr.title);
        if (cleanT && cleanT !== tr.title) {
          tr.title = cleanT;
          if (tr.searchQuery) tr.searchQuery = `${tr.artist || cleanName} - ${cleanT}`.trim();
        }
      }
      return tr;
    });
    if (Array.isArray(artistData.albums)) {
      artistData.albums.forEach(alb => {
        if (alb && alb.title && typeof stripBracketTranslation === 'function') {
          alb.title = stripBracketTranslation(alb.title) || alb.title;
        }
      });
    }
    state.artistTracks = allTracks;

    const validAlbums = (Array.isArray(artistData.albums) ? artistData.albums : [])
      .filter(a => a && a.title && a.artist && a.artist.toLowerCase().trim() === cleanName.toLowerCase().trim())
      .filter(a => (a.trackCount === undefined || a.trackCount === 0 || a.trackCount > 1) && a.recordType !== 'single');

    ensureArtistSearchSortToolbar();
    allTracks.sort((a, b) => getArtistTrackPlaysCount(b) - getArtistTrackPlaysCount(a));

     
    const secPopular = document.getElementById('artist-section-popular');
    const popularList = document.getElementById('artist-popular-tracks-list');
    const topTracks = sortAndFilterArtistTracks(allTracks, 'popular', artistSearchQuery).slice(0, 5);

    if (popularList) {
      if (allTracks.length === 0 && validAlbums.length === 0) {
        if (secPopular) secPopular.style.display = '';
        popularList.innerHTML = `<div class="m3-search-error-box" style="margin: 20px 32px;"><div class="m3-search-error-title">${escapeHtml(t('No official releases found for this artist'))}</div></div>`;
      } else if (topTracks.length === 0) {
        if (secPopular) secPopular.style.display = 'none';
        popularList.innerHTML = '';
      } else {
        if (secPopular) secPopular.style.display = '';
        ensureArtistTableHead(popularList);
        renderArtistPopularTracks(popularList, topTracks);
      }
    }

     
    const secAlbums = document.getElementById('artist-section-albums');
    const albumsShelf = document.getElementById('artist-albums-shelf');
    if (albumsShelf) {
      if (validAlbums.length === 0) {
        if (secAlbums) secAlbums.style.display = 'none';
        albumsShelf.innerHTML = '';
      } else {
        if (secAlbums) secAlbums.style.display = '';
        renderArtistAlbumCards(albumsShelf, validAlbums, cleanName);
      }
    }

     
    const secAllTracks = document.getElementById('artist-section-all-tracks');
    const allTracksList = document.getElementById('artist-all-tracks-list');
    const countBadge = document.getElementById('artist-tracks-count-badge');

    if (countBadge) {
      const lang = localStorage.getItem('riff_ui_lang') || 'en';
      const trkWord = lang === 'ru' ? 'треков' : 'tracks';
      countBadge.textContent = allTracks.length ? `${allTracks.length} ${trkWord}` : '';
    }

    if (allTracksList) {
      if (allTracks.length === 0) {
        if (secAllTracks) secAllTracks.style.display = 'none';
        allTracksList.innerHTML = '';
      } else {
        if (secAllTracks) secAllTracks.style.display = '';
        ensureArtistTableHead(allTracksList);
        renderTracks(allTracksList, allTracks, 'artist');
      }
    }
  }

  async function openArtistProfile(artistName, hintTrack = null) {
    if (!artistName || !artistName.trim()) return;
    const cleanName = artistName.replace(/ - Topic|VEVO|Official|Records/gi, '').trim();
    if (state.currentView === 'artist' && state.currentArtist === cleanName && state.currentArtistData && !hintTrack) {
      return;
    }
    prefetchArtistPlayCounts(cleanName);

    state.artistLoadToken = (state.artistLoadToken || 0) + 1;
    const myArtistToken = state.artistLoadToken;

    state.currentArtist = cleanName;
    state.previousView = state.currentView;
    switchView('artist');

    closeArtistCategory();

    const hero = document.getElementById('artist-hero');
    if (hero) {
      hero.style.removeProperty('--artist-accent-color');
      document.documentElement.style.removeProperty('--artist-accent-color');
      hero.style.setProperty('--artist-fg', '#ffffff');
      hero.style.setProperty('--artist-fg-bg', '#000000');
    }

    const btnBioModal = document.getElementById('btn-artist-bio-modal');
    if (btnBioModal) btnBioModal.classList.add('hidden');

    if (el.artistProfileName) el.artistProfileName.textContent = cleanName;
    if (el.artistProfileBio) {
      el.artistProfileBio.textContent = '';
      el.artistProfileBio.classList.remove('fade-end');
    }
    if (el.artistTracksCount) el.artistTracksCount.textContent = 'Searching...';
    if (el.artistHeroImg) {
      el.artistHeroImg.onload = null;
      el.artistHeroImg.onerror = null;
      el.artistHeroImg.removeAttribute('src');
      el.artistHeroImg.style.opacity = '0';
      el.artistHeroImg.style.display = 'none';
    }
    if (el.artistFansLine) {
      el.artistFansLine.textContent = '';
      el.artistFansLine.style.display = 'none';
    }
    if (el.artistVerifiedBadge) el.artistVerifiedBadge.classList.add('hidden');

     
    const hdrPopular = document.getElementById('artist-hdr-popular');
    const btnMorePopular = document.getElementById('btn-more-popular');
    const hdrAlbums = document.getElementById('artist-hdr-albums');
    const btnMoreAlbums = document.getElementById('btn-more-albums');
    const hdrAllTracks = document.getElementById('artist-hdr-all-tracks');
    const btnMoreAllTracks = document.getElementById('btn-more-all-tracks');

    const onOpenPopular = () => openArtistCategory('popular', state.currentArtistData);
    const onOpenAlbums = () => openArtistCategory('albums', state.currentArtistData);
    const onOpenAllTracks = () => openArtistCategory('all-tracks', state.currentArtistData);

    if (hdrPopular) hdrPopular.onclick = onOpenPopular;
    if (btnMorePopular) btnMorePopular.onclick = (e) => { e.stopPropagation(); onOpenPopular(); };

    if (hdrAlbums) hdrAlbums.onclick = onOpenAlbums;
    if (btnMoreAlbums) btnMoreAlbums.onclick = (e) => { e.stopPropagation(); onOpenAlbums(); };

    if (hdrAllTracks) hdrAllTracks.onclick = onOpenAllTracks;
    if (btnMoreAllTracks) btnMoreAllTracks.onclick = (e) => { e.stopPropagation(); onOpenAllTracks(); };

    const btnBackCat = document.getElementById('btn-back-artist-cat');
    if (btnBackCat) {
      btnBackCat.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeArtistCategory();
      };
    }

    const popularList = document.getElementById('artist-popular-tracks-list');
    const albumsShelf = document.getElementById('artist-albums-shelf');
    const allTracksList = document.getElementById('artist-all-tracks-list');

    const normTargetArtist = cleanName.toLowerCase();
    const findArtistHintTrack = (list) => (Array.isArray(list) ? list : []).find(tr => tr && tr.title && tr.artist && tr.artist.toLowerCase().includes(normTargetArtist));
    let resolvedHint = (hintTrack && hintTrack.title) || '';
    if (!resolvedHint) {
      const matched = (state.currentTrack && state.currentTrack.artist && state.currentTrack.artist.toLowerCase().includes(normTargetArtist) ? state.currentTrack : null)
        || findArtistHintTrack(state.searchResults)
        || findArtistHintTrack(state.history)
        || findArtistHintTrack(state.favorites);
      if (matched && matched.title) resolvedHint = matched.title;
    }

     
    const artistCacheKey = 'artist_cache_v5_' + cleanName.toLowerCase() + (resolvedHint ? '_' + resolvedHint.toLowerCase() : '');
    const cachedArtist = window.HomeCache && window.HomeCache.get(artistCacheKey, 6 * 3600 * 1000);
    let hasRenderedFromCache = false;

    if (cachedArtist && (cachedArtist.tracks?.length || cachedArtist.albums?.length) && Array.isArray(cachedArtist.banners) && cachedArtist.banners.length > 0) {
      hasRenderedFromCache = true;
      applyArtistDataToUI(cachedArtist, cleanName, myArtistToken);
    } else {
       
      const secPop = document.getElementById('artist-section-popular');
      if (secPop) secPop.style.display = '';
      if (popularList) renderM3SearchLoader(popularList, 64);

      const secAlb = document.getElementById('artist-section-albums');
      if (secAlb) secAlb.style.display = '';
      if (albumsShelf) renderM3Loader(albumsShelf);

      const secAll = document.getElementById('artist-section-all-tracks');
      if (secAll) secAll.style.display = '';
      if (allTracksList) renderM3SearchLoader(allTracksList, 64);
    }

     
    const bioController = new AbortController();
    const bioTimeout = setTimeout(() => bioController.abort(), 9000);

    try {
      const hint = resolvedHint;
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/artist?name=${encodeURIComponent(cleanName)}&hintTrack=${encodeURIComponent(hint)}`, { signal: bioController.signal });
      clearTimeout(bioTimeout);
      const data = await res.json();
      if (state.artistLoadToken !== myArtistToken) return;

      if (!data.success || !data.artist) throw new Error('Artist not found');

      if (window.HomeCache) {
        window.HomeCache.set(artistCacheKey, data.artist);
      }

      if (hasRenderedFromCache && cachedArtist) {
        const cTracks = cachedArtist.tracks || [];
        const nTracks = data.artist.tracks || [];
        const cAlbums = cachedArtist.albums || [];
        const nAlbums = data.artist.albums || [];
        const sameTracks = cTracks.length === nTracks.length && (cTracks.length === 0 || cTracks[0]?.id === nTracks[0]?.id);
        const sameAlbums = cAlbums.length === nAlbums.length && (cAlbums.length === 0 || cAlbums[0]?.id === nAlbums[0]?.id);
        if (sameTracks && sameAlbums) {
          state.currentArtistData = data.artist;
          return;
        }
      }

      applyArtistDataToUI(data.artist, cleanName, myArtistToken);

      if (currentArtistCatType) {
        openArtistCategory(currentArtistCatType, data.artist);
      }
    } catch (e) {
      clearTimeout(bioTimeout);
      if (state.artistLoadToken !== myArtistToken) return;
      if (!hasRenderedFromCache) {
        console.warn('Artist load error:', e);
        if (el.artistHeroImg) {
          el.artistHeroImg.onload = null;
          el.artistHeroImg.onerror = null;
          el.artistHeroImg.removeAttribute('src');
          el.artistHeroImg.style.opacity = '0';
          el.artistHeroImg.style.display = 'none';
        }
        if (hero) hero.style.setProperty('--artist-accent-color', 'var(--md-sys-color-primary-container)');
        if (popularList) {
          popularList.innerHTML = `<div class="m3-search-error-box" style="margin: 20px 32px;"><div class="m3-search-error-title">${escapeHtml(t('No official releases found for this artist'))}</div></div>`;
        }
        if (albumsShelf) albumsShelf.innerHTML = '';
        if (allTracksList) allTracksList.innerHTML = '';
      }
    }
  }

  var btnArtistBioMore = document.getElementById('btn-artist-bio-modal') || document.getElementById('btn-artist-bio-more');
  var artistBioModal = document.getElementById('artist-bio-modal');
  var btnCloseArtistBio = document.getElementById('btn-close-artist-bio');
  if (btnArtistBioMore) {
    btnArtistBioMore.addEventListener('click', () => {
      const modalTitle = document.getElementById('artist-bio-modal-title');
      const modalBody = document.getElementById('artist-bio-modal-body');
      if (modalTitle) modalTitle.textContent = state.currentArtistData?.name || el.artistProfileName?.textContent || 'Artist';
      if (modalBody) modalBody.textContent = (el.artistProfileBio ? el.artistProfileBio.textContent : '');
      if (artistBioModal) openModal(artistBioModal);
    });
  }
  if (btnCloseArtistBio) {
    btnCloseArtistBio.addEventListener('click', () => {
      if (artistBioModal) closeModal(artistBioModal);
    });
  }
  if (artistBioModal) {
    artistBioModal.addEventListener('click', (e) => {
      if (e.target === artistBioModal) closeModal(artistBioModal);
    });
  }

  if (el.btnBackArtist) {
    el.btnBackArtist.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const catDetail = document.getElementById('artist-category-detail');
      if (catDetail && !catDetail.classList.contains('hidden')) {
        closeArtistCategory();
        return;
      }
      const target = (state.previousView && state.previousView !== 'artist') ? state.previousView : 'discover';
      switchView(target);
    };
  }

  if (el.btnBackAlbum) {
    el.btnBackAlbum.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = (state.previousView && state.previousView !== 'album') ? state.previousView : 'discover';
      switchView(target);
    };
  }

  if (el.playbarArtist) {
    el.playbarArtist.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentTrack && state.currentTrack.platform !== 'local') openArtistProfile(state.currentTrack.artist);
    });
  }

  if (el.rightPanelArtist) {
    el.rightPanelArtist.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentTrack && state.currentTrack.platform !== 'local') openArtistProfile(state.currentTrack.artist);
    });
  }


  function ensureTopMomentIconSettingsDOM() {
    if (document.getElementById('setting-top-moment-icon')) return;
    const refItem = document.getElementById('setting-track-row-height') || document.getElementById('setting-interface-font');
    if (!refItem || !refItem.parentNode) return;

    const curIcon = localStorage.getItem('riff_top_moment_icon') || 'heart';
    const item = document.createElement('div');
    item.className = 'setting-item';
    item.id = 'setting-top-moment-icon';
    item.innerHTML = `
      <div class="setting-item-top">
        <span class="setting-name" data-i18n>Top moment icon</span>
      </div>
      <div class="theme-mode-selector" id="top-moment-icon-selector" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
        <button class="theme-mode-btn ${curIcon === 'heart' ? 'active' : ''}" data-icon="heart" type="button" style="border-radius:20px !important;">Heart</button>
        <button class="theme-mode-btn ${curIcon === 'minecraft' ? 'active' : ''}" data-icon="minecraft" type="button" style="border-radius:20px !important;">Minecraft</button>
        <button class="theme-mode-btn ${curIcon === 'honey' ? 'active' : ''}" data-icon="honey" type="button" style="border-radius:20px !important;">Honey</button>
        <button class="theme-mode-btn ${curIcon === 'star' ? 'active' : ''}" data-icon="star" type="button" style="border-radius:20px !important;">Star</button>
        <button class="theme-mode-btn ${curIcon === 'fire' ? 'active' : ''}" data-icon="fire" type="button" style="border-radius:20px !important;">Fire</button>
      </div>
    `;

    refItem.parentNode.insertBefore(item, refItem.nextSibling);

    const selector = item.querySelector('#top-moment-icon-selector');
    if (selector) {
      selector.querySelectorAll('.theme-mode-btn').forEach(btn => {
        btn.onclick = () => {
          const icon = btn.dataset.icon || 'heart';
          localStorage.setItem('riff_top_moment_icon', icon);
          selector.querySelectorAll('.theme-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
          updateTopMomentPin();
          if (typeof syncAllThemeToggleIndicators === 'function') requestAnimationFrame(syncAllThemeToggleIndicators);
        };
      });
    }
  }
  ensureTopMomentIconSettingsDOM();

  var RIFF_FLAME_SVG = `<svg width="20" height="20" viewBox="0 0 578 555" fill="currentColor"><path d="M332.338 31.9017C334.813 39.2389 337.301 46.5688 339.804 53.8913C346.65 74.7 370.849 90.8234 396.492 87.0252C397.785 86.8495 399.062 86.6326 400.348 86.3669C407.957 85.0247 415.561 83.6672 423.159 82.2944C446.596 79.1556 458.061 105.307 448.77 115.743C445.608 122.77 442.461 129.801 439.329 136.837C425.596 169.679 439.612 213.232 473.471 232.344C479.933 236.517 486.403 240.676 492.88 244.821C493.981 246.285 493.745 247.328 493.407 248.135C493.042 248.937 492.491 249.732 491.79 250.256C491.097 250.786 490.251 250.806 489.832 250.206C489.368 249.625 489.511 248.678 489.049 248.256C481.978 251.246 474.914 254.251 467.857 257.27C427.262 275.506 403.732 326.149 417.443 370.677C419.338 378.109 421.248 385.536 423.174 392.958C418.802 386.635 425.155 374.669 436.447 376.689C429.244 374.079 422.036 371.485 414.823 368.906C368.003 352.219 310.867 374.802 288.051 419.957C284.394 426.685 280.751 433.42 277.123 440.163C282.498 427.757 301.968 426.996 308.336 439.757C308.336 439.757 308.336 439.757 308.336 439.757C304.83 432.951 301.309 426.153 297.775 419.362C275.052 373.492 217.164 349.9 169.104 366.585C161.85 369.032 154.599 371.495 147.354 373.973C160.424 370.504 170.82 384.361 165.902 394.368C167.959 386.988 170 379.603 172.026 372.213C186.877 325.566 162.701 271.68 119.642 251.779C112.648 248.638 105.647 245.511 98.6387 242.398C99.2388 243.192 100.509 244.921 100.85 246.556C101.243 248.208 100.902 249.457 100.357 250.256C99.8042 251.06 99.0443 251.698 98.0336 252.245C97.0607 252.787 95.7172 252.948 95.6208 252.256C102.161 248.234 108.693 244.197 115.219 240.147C152.971 219.557 169.652 171.256 154.784 133.816C151.783 126.738 148.768 119.664 145.737 112.596C139.892 109.4 143.532 93.2263 157.822 93.8212C165.379 95.3252 172.941 96.8139 180.508 98.2873C212.832 106.511 246.635 87.7132 257.002 60.1443C259.628 52.8848 262.239 45.618 264.836 38.3439C265.907 34.755 267.541 31.3478 269.8 28.2566C281.165 10.8288 315.802 7.71853 332.338 31.9017C324.701 4.06166 282.506 -11.8981 253.405 10.8113C248.12 14.7998 243.498 19.8304 239.828 25.4595C235.412 31.7968 231.011 38.1413 226.624 44.4932C218.162 55.1648 203.715 56.3531 195.686 50.8503C188.669 47.6576 181.647 44.4803 174.621 41.3182C123.684 17.2019 54.695 73.6585 73.5607 135.689C75.1959 143.204 76.8463 150.714 78.512 158.219C77.37 161.133 74.0651 161.082 73.5772 159.321C66.491 162.283 59.4122 165.259 52.3408 168.25C-14.0469 195.146 -19.7011 303.849 49.3229 338.12C55.9259 342.02 62.5362 345.905 69.1539 349.776C64.3356 348.704 60.1451 343.068 61.2695 336.775C58.6296 343.969 56.005 351.167 53.3956 358.37C23.7661 433.604 106.793 520.091 185.089 491.911C192.427 489.723 199.761 487.52 207.089 485.301C199.383 488.26 189.745 484.654 185.852 477.024C189.329 483.845 192.821 490.658 196.328 497.463C196.328 497.463 196.328 497.463 196.328 497.463C231.344 573.82 353.53 573.059 387.554 497.057C390.937 490.188 394.307 483.312 397.662 476.429C393.676 483.344 384.79 485.94 378.324 482.979C385.694 485.067 393.069 487.139 400.45 489.195C476.968 515.926 555.951 431.33 526.869 359.78C524.128 352.619 521.372 345.462 518.601 338.311C518.586 342.485 515.041 344.878 512.687 344.286C519.242 340.292 525.789 336.284 532.329 332.262C596.434 299.449 589.257 199.138 528.498 175.685C521.364 172.817 514.222 169.963 507.073 167.124C502.691 167.407 496.722 162.71 496.715 155.198C498.249 147.651 499.769 140.099 501.273 132.542C516.692 77.7514 455.527 31.2727 413.737 52.845C406.753 56.1383 399.773 59.4468 392.798 62.7706C392.128 63.1309 391.451 63.4673 390.753 63.7835C377.264 70.2884 357.02 66.2197 345.909 50.7461C341.4 44.4573 336.876 38.1758 332.338 31.9017ZM332.338 31.9017" fill="currentColor"/></svg>`;
  var DEFAULT_HOME_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4,19V10Q4,9.52 4.21,9.1Q4.43,8.67 4.8,8.4l6-4.5Q11.33,3.5 12,3.5t1.2,0.4l6,4.5q0.38,0.28 0.59,0.7Q20,9.52 20,10v9q0,0.82-0.59,1.41T18,21H15q-0.42,0-0.71-0.29Q14,20.43 14,20V15q0-0.43-0.29-0.71T13,14H11q-0.42,0-0.71,0.29T10,15v5q0,0.43-0.29,0.71T9,21H6q-0.82,0-1.41-0.59T4,19Z"/></svg>`;


  function onTrackArtUpdated(track) {
    if (!track) return;

    const currentCover = getTrackThumbUrl(track);
    if (currentCover) coverAnalysisCache.delete(currentCover);
    if (track.thumbnail) coverAnalysisCache.delete(track.thumbnail);
    const art = getTrackArt(track);
    if (art.cover) coverAnalysisCache.delete(art.cover);

    if (track.id) {
      const cleanId = String(track.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      if (typeof analysisCache !== 'undefined' && analysisCache.delete) {
        analysisCache.delete(cleanId);
      }
    }

    if (state.currentTrack && isSameTrack(state.currentTrack, track)) {
      const thumb = getTrackThumbUrl(state.currentTrack);
      if (thumb) {
        if (el.playbarArtwork) {
          el.playbarArtwork.src = thumb;
          if (typeof m3cSetImage === 'function') m3cSetImage(thumb);
          el.playbarArtwork.style.display = 'block';
        }
        if (el.artworkFallback) el.artworkFallback.style.display = 'none';
        if (el.rightPanelCover) {
          el.rightPanelCover.src = thumb;
          el.rightPanelCover.style.display = 'block';
        }
        if (el.rightPanelFallback) el.rightPanelFallback.style.display = 'none';
      }
      updateRightPanelBanner(thumb);
      updateMediaSession();
      updateThemeFromState();
    }

    const canonical = getTrackCanonicalId(track);
    document.querySelectorAll('.track-row').forEach(row => {
      if (row.dataset && row.dataset.canonicalId === canonical) {
        const wrap = row.querySelector('.track-row-thumb-wrap');
        const img = row.querySelector('.track-row-thumb');
        const newThumb = getTrackThumbUrl(track);
        if (img) {
          if (newThumb) {
            img.src = newThumb;
            img.style.display = '';
          } else {
            img.style.display = 'none';
          }
        } else if (wrap && newThumb) {
          const newImg = document.createElement('img');
          newImg.className = 'track-row-thumb';
          newImg.src = newThumb;
          newImg.alt = '';
          newImg.onerror = () => { newImg.style.display = 'none'; };
          wrap.appendChild(newImg);
        }
      }
    });
  }

  function renderTrackArtModal() {
    if (!trackArtCurrentTrack) return;
    const t = trackArtCurrentTrack;
    const titleEl = document.getElementById('track-art-modal-title');
    if (titleEl) titleEl.textContent = `Art: ${t.title || 'Untitled'}`;

    const art = getTrackArt(t);

    const coverImg = document.getElementById('track-art-cover-img');
    const coverPh = document.getElementById('track-art-cover-placeholder');
    const coverStatus = document.getElementById('track-art-cover-status');
    const activeCover = art.cover || t.thumbnail || '';
    if (activeCover) {
      if (coverImg) {
        coverImg.src = activeCover;
        coverImg.style.display = 'block';
      }
      if (coverPh) coverPh.style.display = 'none';
    } else {
      if (coverImg) coverImg.style.display = 'none';
      if (coverPh) coverPh.style.display = 'block';
    }
    if (coverStatus) coverStatus.textContent = art.cover ? 'Custom cover' : 'Default art';

    const bannerImg = document.getElementById('track-art-banner-img');
    const bannerVid = document.getElementById('track-art-banner-vid');
    const bannerPh = document.getElementById('track-art-banner-placeholder');
    const bannerStatus = document.getElementById('track-art-banner-status');
    const activeBanner = art.banner || localStorage.getItem('riff_banner_media') || activeCover;
    const isVideo = activeBanner && /\.(mp4|webm)($|\?)/i.test(activeBanner);

    if (activeBanner) {
      if (isVideo) {
        if (bannerImg) bannerImg.style.display = 'none';
        if (bannerVid) {
          bannerVid.src = activeBanner;
          bannerVid.style.display = 'block';
        }
      } else {
        if (bannerVid) bannerVid.style.display = 'none';
        if (bannerImg) {
          bannerImg.src = activeBanner;
          bannerImg.style.display = 'block';
        }
      }
      if (bannerPh) bannerPh.style.display = 'none';
    } else {
      if (bannerImg) bannerImg.style.display = 'none';
      if (bannerVid) bannerVid.style.display = 'none';
      if (bannerPh) bannerPh.style.display = 'block';
    }
    if (bannerStatus) bannerStatus.textContent = art.banner ? 'Custom banner' : (localStorage.getItem('riff_banner_media') ? 'Global banner' : 'Default art');

    const btnCustomFx = document.getElementById('btn-track-banner-custom-fx');
    const fxControls = document.getElementById('track-banner-fx-controls');
    const sliderBlur = document.getElementById('slider-track-banner-blur');
    const sliderOpacity = document.getElementById('slider-track-banner-opacity');
    const sliderFade = document.getElementById('slider-track-banner-fade');
    const valBlur = document.getElementById('val-track-banner-blur');
    const valOpacity = document.getElementById('val-track-banner-opacity');
    const valFade = document.getElementById('val-track-banner-fade');

    const isFxOn = !!(art.bannerCustomFx || (art.bannerFx && art.bannerFx.enabled));
    if (btnCustomFx) btnCustomFx.classList.toggle('active', isFxOn);
    if (fxControls) fxControls.style.display = isFxOn ? 'flex' : 'none';

    const curBlur = art.bannerBlur !== undefined ? art.bannerBlur : (art.bannerFx && art.bannerFx.blur !== undefined ? art.bannerFx.blur : 3);
    const curOpacity = art.bannerOpacity !== undefined ? art.bannerOpacity : (art.bannerFx && art.bannerFx.opacity !== undefined ? art.bannerFx.opacity : 100);
    const curFade = art.bannerFade !== undefined ? art.bannerFade : (art.bannerFx && art.bannerFx.fade !== undefined ? art.bannerFx.fade : 100);

    if (sliderBlur) {
      sliderBlur.value = curBlur;
      if (valBlur) valBlur.textContent = `${curBlur}px`;
      if (typeof updateRangeProg === 'function') updateRangeProg(sliderBlur);
    }
    if (sliderOpacity) {
      sliderOpacity.value = curOpacity;
      if (valOpacity) valOpacity.textContent = `${curOpacity}%`;
      if (typeof updateRangeProg === 'function') updateRangeProg(sliderOpacity);
    }
    if (sliderFade) {
      sliderFade.value = curFade;
      if (valFade) valFade.textContent = `${curFade}%`;
      if (typeof updateRangeProg === 'function') updateRangeProg(sliderFade);
    }

    if (btnCustomFx) {
      btnCustomFx.onclick = () => {
        const next = !btnCustomFx.classList.contains('active');
        btnCustomFx.classList.toggle('active', next);
        if (fxControls) fxControls.style.display = next ? 'flex' : 'none';
        const b = sliderBlur ? parseInt(sliderBlur.value, 10) : curBlur;
        const o = sliderOpacity ? parseInt(sliderOpacity.value, 10) : curOpacity;
        const f = sliderFade ? parseInt(sliderFade.value, 10) : curFade;
        setTrackArt(t, {
          bannerCustomFx: next,
          bannerBlur: b,
          bannerOpacity: o,
          bannerFade: f,
          bannerFx: { enabled: next, blur: b, opacity: o, fade: f }
        });
        onTrackArtUpdated(t);
      };
    }

    if (sliderBlur) {
      sliderBlur.oninput = (e) => {
        const v = parseInt(e.target.value, 10);
        if (valBlur) valBlur.textContent = `${v}px`;
        if (typeof updateRangeProg === 'function') updateRangeProg(e.target);
        const o = sliderOpacity ? parseInt(sliderOpacity.value, 10) : 100;
        const f = sliderFade ? parseInt(sliderFade.value, 10) : 100;
        const active = btnCustomFx ? btnCustomFx.classList.contains('active') : true;
        setTrackArt(t, {
          bannerCustomFx: active,
          bannerBlur: v,
          bannerOpacity: o,
          bannerFade: f,
          bannerFx: { enabled: active, blur: v, opacity: o, fade: f }
        });
        onTrackArtUpdated(t);
      };
    }

    if (sliderOpacity) {
      sliderOpacity.oninput = (e) => {
        const v = parseInt(e.target.value, 10);
        if (valOpacity) valOpacity.textContent = `${v}%`;
        if (typeof updateRangeProg === 'function') updateRangeProg(e.target);
        const b = sliderBlur ? parseInt(sliderBlur.value, 10) : 3;
        const f = sliderFade ? parseInt(sliderFade.value, 10) : 100;
        const active = btnCustomFx ? btnCustomFx.classList.contains('active') : true;
        setTrackArt(t, {
          bannerCustomFx: active,
          bannerBlur: b,
          bannerOpacity: v,
          bannerFade: f,
          bannerFx: { enabled: active, blur: b, opacity: v, fade: f }
        });
        onTrackArtUpdated(t);
      };
    }

    if (sliderFade) {
      sliderFade.oninput = (e) => {
        const v = parseInt(e.target.value, 10);
        if (valFade) valFade.textContent = `${v}%`;
        if (typeof updateRangeProg === 'function') updateRangeProg(e.target);
        const b = sliderBlur ? parseInt(sliderBlur.value, 10) : 3;
        const o = sliderOpacity ? parseInt(sliderOpacity.value, 10) : 100;
        const active = btnCustomFx ? btnCustomFx.classList.contains('active') : true;
        setTrackArt(t, {
          bannerCustomFx: active,
          bannerBlur: b,
          bannerOpacity: o,
          bannerFade: v,
          bannerFx: { enabled: active, blur: b, opacity: v, fade: v }
        });
        onTrackArtUpdated(t);
      };
    }
  }

  function openTrackArtModal(track, triggerEl = null) {
    if (!track) return;
    trackArtCurrentTrack = track;
    const modal = document.getElementById('track-art-modal');
    if (!modal) return;
    renderTrackArtModal();
    const card = modal.querySelector('.dialog-card') || modal;
    if (card) {
      card.classList.remove('liquid-surface', 'liquid-x', 'liquid-y', 'liquid-open', 'liquid-closing');
    }
    openModal(modal);
  }
  window.openTrackArtModal = openTrackArtModal;

  function closeTrackArtModal() {
    const modal = document.getElementById('track-art-modal');
    if (!modal) return;
    const card = modal.querySelector('.dialog-card') || modal;
    if (card) {
      card.classList.remove('liquid-surface', 'liquid-x', 'liquid-y', 'liquid-open', 'liquid-closing');
    }
    closeModal(modal);
  }

  var trackArtModal = document.getElementById('track-art-modal');
  var btnCloseTrackArtModal = document.getElementById('btn-close-track-art-modal');
  var btnChooseTrackCover = document.getElementById('btn-choose-track-cover');
  var btnResetTrackCover = document.getElementById('btn-reset-track-cover');
  var btnChooseTrackBanner = document.getElementById('btn-choose-track-banner');
  var btnResetTrackBanner = document.getElementById('btn-reset-track-banner');
  var btnRightPanelArt = document.getElementById('btn-right-panel-art');

  if (btnRightPanelArt) {
    btnRightPanelArt.addEventListener('click', () => {
      if (state.currentTrack) {
        openTrackArtModal(state.currentTrack, btnRightPanelArt);
      }
    });
  }

  if (btnCloseTrackArtModal) {
    btnCloseTrackArtModal.addEventListener('click', closeTrackArtModal);
  }

  if (trackArtModal) {
    trackArtModal.addEventListener('click', (e) => {
      if (e.target === trackArtModal) closeTrackArtModal();
    });
  }

  var isImageFile = (u) => /\.(png|jpe?g|webp|gif)($|\?)/i.test(u);
  var isMediaFile = (u) => /\.(png|jpe?g|webp|gif|mp4|webm)($|\?)/i.test(u);

  if (btnChooseTrackCover) {
    btnChooseTrackCover.addEventListener('click', async () => {
      if (!trackArtCurrentTrack) return;
      if (window.electronAPI && window.electronAPI.pickMedia) {
        const url = await window.electronAPI.pickMedia();
        if (url) {
          if (!isImageFile(url)) {
            showToast('Cover must be an image (PNG, JPG, WebP, GIF)');
            return;
          }
          setTrackArt(trackArtCurrentTrack, { cover: url });
          onTrackArtUpdated(trackArtCurrentTrack);
          renderTrackArtModal();
        }
      }
    });
  }

  if (btnResetTrackCover) {
    btnResetTrackCover.addEventListener('click', () => {
      if (!trackArtCurrentTrack) return;
      setTrackArt(trackArtCurrentTrack, { cover: undefined });
      onTrackArtUpdated(trackArtCurrentTrack);
      renderTrackArtModal();
    });
  }

  if (btnChooseTrackBanner) {
    btnChooseTrackBanner.addEventListener('click', async () => {
      if (!trackArtCurrentTrack) return;
      if (window.electronAPI && window.electronAPI.pickMedia) {
        const url = await window.electronAPI.pickMedia();
        if (url) {
          if (!isMediaFile(url)) {
            showToast('Banner must be image or video (PNG, JPG, WebP, GIF, MP4, WebM)');
            return;
          }
          setTrackArt(trackArtCurrentTrack, { banner: url });
          onTrackArtUpdated(trackArtCurrentTrack);
          renderTrackArtModal();
        }
      }
    });
  }

  if (btnResetTrackBanner) {
    btnResetTrackBanner.addEventListener('click', () => {
      if (!trackArtCurrentTrack) return;
      setTrackArt(trackArtCurrentTrack, { banner: undefined });
      onTrackArtUpdated(trackArtCurrentTrack);
      renderTrackArtModal();
    });
  }

  var DEFAULT_SIDEBAR_ORDER = ['discover', 'favorites', 'albums', 'local', 'history', 'queue'];

  var SIDEBAR_ITEM_DEFS = {
    discover: { name: 'Home', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4,19V10Q4,9.52 4.21,9.1Q4.43,8.67 4.8,8.4l6-4.5Q11.33,3.5 12,3.5t1.2,0.4l6,4.5q0.38,0.28 0.59,0.7Q20,9.52 20,10v9q0,0.82-0.59,1.41T18,21H15q-0.42,0-0.71-0.29Q14,20.43 14,20V15q0-0.43-0.29-0.71T13,14H11q-0.42,0-0.71,0.29T10,15v5q0,0.43-0.29,0.71T9,21H6q-0.82,0-1.41-0.59T4,19Z"/></svg>' },
    favorites: { name: 'Favorites', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' },
    albums: { name: 'Albums', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>' },
    local: { name: 'My files', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' },
    history: { name: 'History', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
    queue: { name: 'Queue', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="14" y2="17"/></svg>' }
  };



function renderArtistView(artistName, hintTrack = null) {
  if (typeof openArtistProfile === 'function') {
    return openArtistProfile(artistName, hintTrack);
  }
}
window.renderArtistView = renderArtistView;
window.openArtistProfile = openArtistProfile;
window.toggleFollowArtist = toggleFollowArtist;
window.openAlbum = openAlbum;
window.updateRightPanelCredits = updateRightPanelCredits;
window.getTopMomentsMap = getTopMomentsMap;
window.getTopMoment = getTopMoment;
window.setTopMoment = setTopMoment;
window.renderTrackArtModal = renderTrackArtModal;
window.openTrackArtModal = openTrackArtModal;

