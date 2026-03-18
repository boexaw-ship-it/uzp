# UZ P — Live Sports Player

A clean, mobile-first IPTV stream player. Upload your `.m3u` playlist and watch live sports directly in the browser.

## Features
- 📂 Load `.m3u` / `.m3u8` playlist files
- ⚽ Channel list with category tabs & search
- 📺 HLS stream playback (hls.js)
- 🔄 Resolution switcher (Auto / 1080p / 720p / etc.)
- 📱 Mobile-first, PWA ready
- 🌙 Dark theme

## Deploy to GitHub Pages

1. Fork or upload this folder to a GitHub repo
2. Go to **Settings → Pages → Branch: main → Save**
3. Visit `https://yourusername.github.io/uzp/`

## Folder Structure

```
uzp/
├── index.html        ← Main app
├── manifest.json     ← PWA manifest
├── css/
│   └── style.css     ← All styles
├── js/
│   └── app.js        ← All logic
└── assets/
    ├── icon-192.png  ← App icon (add manually)
    └── icon-512.png  ← App icon (add manually)
```

## Usage

1. Open the website
2. Tap **Upload** → select your `.m3u` file
3. Channel list appears → tap any channel → watch
4. Or paste a `.m3u8` URL directly → PLAY
