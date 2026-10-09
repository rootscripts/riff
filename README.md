<p align="center">
  <img src="banner.png" alt="Riff Banner" width="100%">
</p>

# Riff

Riff is a free forever, best and freshly updating desktop music player for Windows and Linux. It is made for playing music, managing a music library, and downloading tracks for offline listening.

The interface uses Material Design 3 (You), but the player is kept fairly simple and focused on the music itself.

Riff can get tracks from YouTube and SoundCloud, store them locally, and add them to your library. It also includes best audio editor, lyrics word-by-word support, Discord RPC, media keys, and playlists.

## Features

### Music downloads

Riff can download audio from:

* YouTube
* YT Music
* SoundCloud

Downloaded tracks can be added to the local library and played without an internet connection

### Local music library

Your music files stay on your computer.

Riff can read track information such as:

* Title
* Artist
* Album
* Track number
* Album art
* Other common audio tags

You can also organize music into folders and playlists.

### Audio editor

Riff has a small built-in editor for making simple changes to a track.

You can:

* Speed up/slow down tracks realtime
* Add reverb, distortion, make the track sound high quality by equalizing
* Trim the beginning or end of a track
* Select a part of a song
* Save a selected section as a separate file

It is meant for quick edits, so you do not need to open another program for small changes.

### Lyrics

Lyrics are enabled with online search by default.

Riff supports:

* Plain text lyrics
* LRC files
* Manual lyric timing
* Online auto lyric timing

LRC files can be used when you already have timestamps. You can also adjust the timing yourself from inside the player.

### Discord Rich Presence

Riff can show what you are listening to on Discord.

The Rich Presence can include:

* Track name
* Artist
* track progress

### Playlists

You can create and manage playlists from your local music library.

Tracks can be added or removed without changing the original files.

### Background playback

Music continues playing while Riff is in the background or minimized.

### Offline use

Riff does not require an account to play local music.

Your local library, playlists, downloaded files, and other music data can stay on your computer.

Riff does not need a subscription or paid Premium.

## Memory usage

Riff is designed to stay relatively light, comfortable and fast for a desktop music player.

On a typical system, it uses around **~200 MB of RAM**, although actual usage depends on the number of tracks loaded, the current features being used, and the system itself.

## Requirements

* Node.js 18 or newer
* npm
* yt-dlp, ffmpeg

! ALL OF THESE ARE INSTALLED BY DEFAULT AND COMPILED IN RELEASES !

## Getting started

Clone the repository:

```bash
git clone https://github.com/rootscripts/riff.git
cd riff
```

Install the dependencies:

```bash
npm install
```

Start the development version:

```bash
npm run dev
```

## Building

To create a production build, use:

```bash
npm run build
```

The exact build output depends on the current project configuration.

## Project structure

Some of the main parts of the project are organized around the player, library, and UI.

The banner used in this README is located at:

```text
rootscripts/riff/banner.png
```

More detailed information about the source structure and build process can be added as the project grows.

## Notes

Developed for educational and personal media management purposes only. Users are responsible for complying with local copyright laws and the terms of service of any third-party streaming platforms.

Riff is primarily intended for personal use with music you are allowed to download and store.

When downloading content from third-party services, make sure your use of that content follows the service's rules and the laws that apply to you.

## License
MIT
