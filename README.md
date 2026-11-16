<div align="center">

# Riff

**Desktop music player for YouTube Music, SoundCloud, and local audio.**

[![Release](https://img.shields.io/github/v/release/rootscripts/riff?style=flat-square&label=release&labelColor=0d0d10&color=6750A4)](https://github.com/rootscripts/riff/releases) [![Downloads](https://img.shields.io/github/downloads/rootscripts/riff/total?style=flat-square&label=downloads&labelColor=0d0d10&color=4d71ff)](https://github.com/rootscripts/riff/releases) [![Platforms](https://img.shields.io/badge/platforms-Windows%20·%20Linux%20·%20macOS-2ec4b6?style=flat-square&labelColor=0d0d10)](https://github.com/rootscripts/riff/releases) [![License](https://img.shields.io/badge/license-MIT-534dff?style=flat-square&labelColor=0d0d10)](./LICENSE)

[Overview](#overview) • [Features](#features) • [Architecture](#architecture) • [Getting Started](#getting-started) • [Building](#building) • [macOS Notes](#macos-notes) • [Contributing](#contributing) • [License](#license)

<br/>

<img src="./banner.png" alt="Riff Preview" width="100%" />

</div>

---

## Overview

Riff is an open-source desktop music player for Windows, Linux, and macOS. It streams from YouTube Music, YouTube, and SoundCloud without ads, and plays local audio files (FLAC, WAV, MP3, OGG).

No account or subscription required. No tracking or telemetry.

---

## Features

- **Streaming & Local Files**: Stream from YouTube Music, YouTube, and SoundCloud without ads, or play local lossless tracks (FLAC, WAV, MP3, OGG, M4A).
- **Synced Lyrics**: Syllable and timestamped lyrics with support for `.lrc` files, manual timing offset, and translations.
- **Audio Tools**: 10-band equalizer with presets, playback speed and pitch control, reverb, and an in-app audio trimmer.
- **Playlist Migration**: Import public playlists from Spotify, Apple Music, Deezer, and YouTube directly into your library.
- **Visualizers**: WebGL and canvas audio visualizers.
- **Interface & Themes**: Theme customizer with dynamic colors extracted from album art, plus a built-in CSS editor for custom styles.
- **Discord RPC**: Shows the active track, artist, and playback progress in Discord.
- **Plugins**: Extensible system for custom functionality and themes.

---

## Architecture

Riff is built with Electron and runs an internal proxy server alongside a Vanilla JS and WebGL renderer.

```
riff/
├── assets/              # Icons and UI presets
├── scripts/             # Build and packaging scripts
├── src/
│   ├── main/            # Electron main process
│   │   ├── main.js      # App lifecycle, window management, and IPC
│   │   ├── discord.js   # Discord Rich Presence
│   │   ├── launcher.js  # yt-dlp and ffmpeg runner
│   │   ├── plugins.js   # Plugin loader
│   │   ├── preload.js   # Context bridge to renderer
│   │   ├── themes.js    # Theme and custom CSS handler
│   │   └── updater.js   # Auto-update manager
│   ├── renderer/        # Frontend UI (Vanilla JS & HTML5)
│   │   ├── audio.js     # Web Audio API playback engine
│   │   ├── styles.css   # Main stylesheet
│   │   └── modules/     # UI modules
│   │       ├── eq.js    # Equalizer and audio filters
│   │       ├── lyrics.js# Synced lyrics renderer and parser
│   │       ├── visualizer.js # WebGL and canvas visualizers
│   │       ├── library.js    # Local file indexing
│   │       ├── import.js     # Playlist importer
│   │       └── ui.js         # UI controls and color extraction
│   ├── server/          # Local backend proxy
│   │   ├── server.js    # Stream resolution and caching
│   │   └── tools.js     # Media extractors
│   └── shared/          # Shared constants and schemas
├── vendor/              # Bundled binaries
├── package.json
└── LICENSE
```

---

## Getting Started

### Prerequisites

- **Node.js** `18+`
- **npm**

---

### Setup

```bash
git clone https://github.com/rootscripts/riff.git
cd riff
npm install
```

---

### Running in Development

```bash
npm start
```

---

## Building

```bash
# Build for your current OS (output goes to dist/)
npm run dist
```

Pre-built binaries for Windows (`.exe`), Linux (`.AppImage`), and macOS (`.dmg`) are also available on [Releases](https://github.com/rootscripts/riff/releases).

---

## macOS Notes

macOS releases are ad-hoc signed. If Gatekeeper blocks the app on first launch:

1. Right-click `Riff.app` in `/Applications`, click **Open**, and confirm. On macOS 15+, open **System Settings → Privacy & Security** and select **Open Anyway**.
2. If macOS reports the bundle as damaged, run:
   ```bash
   xattr -cr /Applications/Riff.app
   ```
3. On Apple Silicon, installing dependencies via Homebrew is recommended:
   ```bash
   brew install yt-dlp ffmpeg
   ```

---

## Contributing

Bug reports and fixes are welcome. Check [Issues](https://github.com/rootscripts/riff/issues) before opening a ticket. For experiments or major feature additions, you are welcome to fork the repository.

---

## License

Distributed under the [MIT License](./LICENSE).
