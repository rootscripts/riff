'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '../src/renderer/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');

test('add-to-playlist UI offers audio presets', () => {
  assert.match(html, /id="playlist-save-audio-preset"/);
  assert.match(app, /getAllPresets\(\)/);
  assert.match(app, /presetSelect\.add\(new Option\(preset\.name, preset\.id\)\)/);
});

test('new playlist entries hold separate snapshots rather than modifying songs', () => {
  assert.match(app, /const entry = stampAddedAt\(t\)/);
  assert.match(app, /entry\.playlistAudioPreset = JSON\.parse\(JSON\.stringify\(normalizePreset\(chosenPreset\)\)\)/);
  assert.match(app, /pl\.tracks\.push\(makePlaylistEntry\(track\)\)/);
  assert.match(app, /pl\.tracks\.push\(makePlaylistEntry\(t\)\)/);
});

test('playback applies entry-specific preset and restores previously active preset', () => {
  assert.match(app, /applyPlaylistEntryPreset\(track\);/);
  assert.match(app, /if \(saved && saved\.settings\)/);
  assert.match(app, /else if \(presetBeforePlaylistPlayback\)/);
  assert.match(app, /applyPreset\(prior\)/);
});
