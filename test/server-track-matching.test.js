'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanSearchResults,
  getTrackNormalizedKey,
  makeCleanSearchQuery,
  scoreImportedCandidate
} = require('../src/server/server');

const track = (id, title, artist = 'Daft Punk') => ({
  id, title, artist, duration: 200, platform: 'youtube'
});

test('does not interpret the "ft" in Daft Punk as a featured artist', () => {
  assert.equal(getTrackNormalizedKey('Daft Punk', 'Get Lucky'), 'daft punk::get lucky');
  assert.equal(makeCleanSearchQuery('Daft Punk', 'Get Lucky'), 'Daft Punk Get Lucky');
  assert.equal(getTrackNormalizedKey('Daft Punk feat. Pharrell Williams', 'Get Lucky'), 'daft punk::get lucky');
});

test('keeps named bracketed edits separate from the standard version', () => {
  assert.notEqual(getTrackNormalizedKey('Daft Punk', 'Get Lucky'),
    getTrackNormalizedKey('Daft Punk', 'Get Lucky [Slowed + Reverb]'));
  assert.deepEqual(cleanSearchResults([
    track('standard', 'Get Lucky'),
    track('slowed', 'Get Lucky [Slowed + Reverb]')
  ], 'Get Lucky').map(({ id }) => id), ['standard', 'slowed']);
});

test('deduplicates presentation labels, including official audio', () => {
  assert.equal(getTrackNormalizedKey('Daft Punk', 'Get Lucky [Official Audio]'),
    getTrackNormalizedKey('Daft Punk', 'Get Lucky'));
});

test('retains a sufficiently close title-only result with an uninformative uploader', () => {
  const results = cleanSearchResults([
    track('close', 'Blinding Lights (Slowed)', 'Remix Uploader'),
    track('unrelated', 'Unrelated Song', 'Other Artist')
  ], 'Blinding Lights Slowed Reverb');
  assert.deepEqual(results.map(({ id }) => id), ['close']);
});

test('does not admit weak matches with only one word out of a two-word search', () => {
  const results = cleanSearchResults([
    track('weak', 'Maple (Slowed)', 'Other Artist'),
    track('exact', 'Chainsaww Maple', 'Chainsaww')
  ], 'Chainsaww Maple');
  assert.deepEqual(results.map(({ id }) => id), ['exact']);
});

test('does not silently substitute the original for an explicitly requested edit', () => {
  const original = track('standard', 'Get Lucky');
  const slowed = track('slowed', 'Get Lucky (Slowed + Reverb)');
  assert.ok(scoreImportedCandidate('Get Lucky slowed reverb', 'Daft Punk', 200, original) < 0);
  assert.ok(scoreImportedCandidate('Get Lucky slowed reverb', 'Daft Punk', 200, slowed) > 0);
});

test('matches nightcore and hardstyle variants but rejects unmatched originals', () => {
  assert.ok(scoreImportedCandidate('How Do You Do nightcore', 'Roxette', 200,
    track('original', 'How Do You Do', 'Roxette')) < 0);
  assert.ok(scoreImportedCandidate('How Do You Do nightcore', 'Roxette', 200,
    track('nightcore', 'Nightcore - How Do You Do', 'Roxette')) > 0);
  assert.ok(scoreImportedCandidate('Get Lucky hardstyle remix', 'Daft Punk', 200,
    track('original', 'Get Lucky')) < 0);
  assert.ok(scoreImportedCandidate('Get Lucky hardstyle remix', 'Daft Punk', 200,
    track('hardstyle', 'Get Lucky (Hardstyle Remix)')) > 0);
});
