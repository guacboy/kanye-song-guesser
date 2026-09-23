# KanyeGuess

Guess the Kanye West song from a 0.5s → 1s → 4s → 8s clip. Built with Phaser 3 + TypeScript + Vite, for playing in the browser on itch.io.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
```

## Adding songs

1. Put the audio file in `public/audio/` (mp3, ogg, m4a or wav).
2. Add an entry to [src/data/songs.json](src/data/songs.json):

   ```json
   { "title": "Flashing Lights", "artists": ["Kanye West"], "features": ["Dwele"],
     "album": "Graduation", "file": "audio/flashing-lights.mp3", "tier": "1b", "start": 0 }
   ```

   - `artists`: the main credited artists. `features` (optional) lists featured artists. The dropdown shows them under the title as "Kanye West feat. Dwele".
   - `tier`: the song's highest stream bracket (`"1b" | "100m" | "1m" | "100k"`). Brackets are cumulative, so the "> 1M" playlist also includes the "> 100M" and "> 1B" songs.
   - `start` (optional): where in the file the clip begins, in seconds.
   - `aliases` (optional): other spellings that count as correct.

The game and the dropdown only use songs whose file exists in `public/audio/`. The list is sorted alphabetically. Entries without a file are ignored. The folder is scanned at build time; the dev server restarts itself when you add or remove a file.

## Tests

The tests check the manifest (fields, tiers, duplicates) and that every audio file has an entry with matching filename casing. They also test the answer-checking, sorting and search logic, and that the game builds with itch.io-safe relative paths.

```sh
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m pytest
```

**Pre-push gate:** `npm install` enables the hook in `.githooks/pre-push`, which runs pytest and blocks `git push` if any test fails. To enable it manually, run `git config core.hooksPath .githooks`. To skip it in an emergency, use `git push --no-verify`.

## Art

- **Life icon:** `public/assets/life.png`, scaled to fit 48 px. If it's missing, the game draws a placeholder heart.
- **Playlist backgrounds:** `public/assets/playlists/1b.png`, `100m.png`, `1m.png`, `100k.png`. They fill the 160 px square cards; non-square images are center-cropped. Use at least 480×480 so they stay sharp on high-DPI screens. A dark overlay keeps the text readable. A card without an image is drawn as a plain outline.

## Publishing to itch.io

```sh
npm run zip      # builds and creates kanye-song-guesser.zip from dist/
```

On itch.io: create a new project → Kind of project: **HTML** → upload the zip → tick **This file will be played in the browser** → viewport **800 × 600** (the game scales to fit, so other sizes also work).
