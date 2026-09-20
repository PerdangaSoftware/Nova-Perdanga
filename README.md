
<div align="center">
  <img src="ico/NovaPerdanga.png" alt="NovaPerdanga Logo" width="128">
  <h1>Nova-Perdanga</h1>
  <p><i>Your browser's window to Wallhaven!</i></p>
</div>


<div align="center">
  <img src="https://gitlab.com/perdanga/nova-perdanga/-/raw/main/Screenshots/Nova-Perdanga.png?ref_type=heads" alt="NovaPerdanga Interface" width="100%">
</div>

## 🗻 Overview

**Nova-Perdanga** transforms your browser's default New Tab into a personal dashboard. It combines the infinite library of **Wallhaven** with your own offline wallpaper collection, smart color adaptation, and power-user keyboard controls.


## Installation

1. Download or clone this repository:
   ```bash
   git clone https://gitlab.com/perdanga/nova-perdanga.git
   ```
2. Open your Chromium-based browser.
3. Navigate to `chrome://extensions/`.
4. Toggle **Developer mode** on (top right corner).
5. Click **Load unpacked** and select the extension folder.
6. Open a new tab and enjoy!

## Features


### Wallpaper Engine
- **Wallhaven Integration**: Automatically stream wallpapers by tags or top-rated collections.
- **Local Storage Gallery**: Upload your personal wallpapers directly into browser-native IndexedDB.
- **One-Click Batch Download (.zip)**: Export your entire wallpaper collection into a neat `.zip` archive with a single click.
- **Custom Framing**: Adjust vertical (Y-axis) alignment per wallpaper for optimal positioning.
- **Seamless Preloader**: Intelligent background preloading ensures smooth, flicker-free crossfades between images.

### Smart Search 
- **Search Autocomplete**: Real-time suggestions powered by Google, DuckDuckGo, or Bing.
- **Dynamic Color Matching**: Automatically extracts the dominant background color to tint the search bar.
- **Search Bangs**: Jump directly to popular services by prefixing queries:
  - `!y <query>` → YouTube
  - `!wiki <query>` → Wikipedia (supports multilingual & Cyrillic queries)
  - `!r <query>` → Reddit
  - `!gl [query]` → GitLab (`perdanga/nova-perdanga` repository by default)
  - `!gh <query>` → GitHub

### ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `/` or `Space` | Focus search |
| `N` or `→` | Next wallpaper |
| `P` or `←` | Previous wallpaper |
| `M` | Switch mode (Wallhaven ⟷ Local) |
| `S` | Save to local |
| `H` / `Z`  | Zen Mode (hide UI) |
| `O` or `,` | Toggle settings |
| `Esc` | Close / Exit |


### Timer Widget
- Draggable, collapsible floating timer with circular progress and chime alarms.
- Quick presets: **5m**, **10m**, **15m**, **25m**, **45m**.

### Weather & Clock
- Accurate weather powered by **Open-Meteo** (temperature, weather status, weather icons).
- Deep-linked forecast providers: **Google**, **Weather.com**, **Yandex**, or **Ventusky**.
- Fully customizable clock (12h/24h, optional seconds), date format, and dynamic greetings.

### Customization
- **10 Curated Fonts**: Inter *(default)*, Plus Jakarta Sans, Outfit, Montserrat, Space Grotesk, Roboto Flex, Playfair Display, Cormorant Garamond, JetBrains Mono, and Roboto Mono.
- **Visual Controls**: Background blur, search bar blur, opacity, brightness, transition speed, and typography sizing.
- **Live Value Badges**: Real-time numerical feedback for all sliders.

### Safe Configuration Backup & Restore
- **Binary ZIP Export**: Back up your settings, timers, and high-resolution wallpapers into a `.zip` archive.
- **Universal Importer**: Effortlessly restore settings from both new `.zip` backups and legacy `.json` files.


## Wallpaper & Configuration Controls

<p align="center">
  <img src="https://gitlab.com/perdanga/nova-perdanga/-/raw/main/Screenshots/Background.png?ref_type=heads" alt="Background Settings" width="200" />
  <img src="https://gitlab.com/perdanga/nova-perdanga/-/raw/main/Screenshots/Timer.png?ref_type=heads" alt="Timer Widget" width="200" />
</p>

- **Save from Wallhaven**: Press **S** or click **★ Save** to store any wallpaper directly in local extension storage.
- **Batch Export**: Click **Download All Wallpapers (.zip)** in the *Local Files* panel to save your entire gallery.
- **Backup & Restore**: Click **Export Config** to archive your entire setup, wallpapers, and timer data into `novaperdanga_backup.zip`.


## Privacy

Nova-Perdanga respects your privacy:
- **No tracking or analytics**: All data, settings, and images stay strictly inside your browser.
