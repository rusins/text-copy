# Text Copy

A GNOME Shell extension that lets you select a screen area, runs OCR on it with Tesseract, and copies the recognized text to your clipboard.

> Vibe-coded with [Claude Code](https://claude.ai/code) by Anthropic.

## How it works

Click the panel icon, select an area of your screen, and the text in that area is automatically copied to your clipboard.

## Requirements

- **GNOME Shell** 45–49
- **Tesseract OCR** — for recognizing the text
  ```
  sudo pacman -S tesseract               # Arch/Manjaro
  sudo apt install tesseract-ocr         # Debian/Ubuntu
  ```
- **Tesseract language data** — at minimum English:
  ```
  sudo pacman -S tesseract-data-eng      # Arch/Manjaro
  sudo apt install tesseract-ocr-eng     # Debian/Ubuntu
  ```
  (`-lav` for Latvian :) )
- **wl-clipboard** — for copying to clipboard on Wayland
  ```
  sudo pacman -S wl-clipboard            # Arch/Manjaro
  sudo apt install wl-clipboard          # Debian/Ubuntu
  ```

## Installation

1. Clone or download this repository.
2. Symlink (or copy) the directory to the GNOME extensions folder:
   ```
   ln -s "$(pwd)" ~/.local/share/gnome-shell/extensions/text-copy@rusins.github.com
   ```
3. Enable the extension:
   ```
   gnome-extensions enable text-copy@rusins.github.com
   ```
4. Log out and back in for the extension to take effect!

## Development

If you edit `schemas/*.gschema.xml`, recompile the schema before reloading:
```
glib-compile-schemas schemas/
```

## Configuration

Open GNOME Extensions preferences to set the OCR language (default: `eng`). Use any language code supported by your installed Tesseract data packages (e.g. `deu`, `fra`, `spa`).
