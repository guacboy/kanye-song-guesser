# kanye-song-guesser

Guess the Kanye West song from a 0.1s -> 0.5s -> 2s -> 8s clip. Each wrong guess or skip unlocks the next length; miss all four and you lose one of three lives. The page has a grey gradient from the top. Once a song is revealed, its album cover appears, the gradient takes on the cover's main color, and 15 seconds of the song play. Built with Phaser 3 + TypeScript + Vite, for playing in the browser on itch.io.

## Scoring

The score in the top left starts at 0. A correct guess scores by the clip it was guessed on:

| Guessed on | Points |
| --- | --- |
| 0.1s | 300 |
| 0.5s | 150 |
| 2s | 75 |
| 8s | 25 |
| Missed | 0 |

The results pop-up shows the total, a breakdown per clip (for example `300 x 2 = 600 pts`) the best score for that playlist, and how many of the playlist's songs you guessed.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
```

## Adding songs

1. Put the audio file in `public/audio/` (mp3, ogg, m4a or wav).
2. Add a line to [src/data/spotify_links.txt](src/data/spotify_links.txt) with the file name and the song's Spotify link (in Spotify: right-click the song -> Share -> Copy Song Link):

   ```
   flashing-lights.mp3   https://open.spotify.com/track/5TRPicyLGbAF2LGBFbHGvO
   ```

3. Run the sync script. It fills in [src/data/songs.json](src/data/songs.json) for you:

   ```sh
   python scripts/sync_songs.py            # or --dry-run to preview
   ```

   - Title, artists, features, album and album cover come from Spotify. Covers are saved to `public/assets/albums/<album id>.jpg` (one per album) and shown when a song is revealed. Main artists are the track's artists who are also credited on the album; everyone else counts as a feature. So "Otis" gets JAY-Z and Kanye West as main artists, with Otis Redding as the feature.
   - Total streams come from [kworb.net](https://kworb.net/spotify/artist/5K4W6rqBFWDnAN6FQUkS6x_songs.html), matched by Spotify track ID. They set the playlist (`tier`): > 1B, > 100M or > 1M. A song with 1M streams or fewer can't be synced. Re-run the script now and then to update the counts.
   - `start` (when the clip begins, in seconds) and `aliases` (other spellings that count as correct) are yours to add by hand in songs.json. Re-running the script keeps them.
   - Entries without a Spotify link are left alone, so you can still write an entry by hand. Give it `title`, `artists`, `album`, `file` and `tier`.

The game and the dropdown only use songs whose file exists in `public/audio/`, sorted alphabetically. Typing a title, artist or album name brings up matching songs. The folder is scanned at build time; the dev server restarts itself when you add or remove a file.

### Spotify credentials (one-time)

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard). Any name works; set the redirect URI to `http://127.0.0.1:8888/callback` (it isn't used). Tick **Web API**.
2. Copy `.env.example` to `.env` and paste in the app's Client ID and Client Secret. `.env` is git-ignored.

Since February 2026, Spotify requires the owner of a Development Mode app to have an **active Spotify Premium subscription**.

## Tests

The tests check the manifest (fields, tiers, duplicates, tier vs. stream count), the sync script (link parsing, artist/feature split, kworb matching; the network is faked) and that every audio file has an entry with matching filename casing. They also test the answer-checking, scoring, sorting and search logic, the album backdrop color, the saved volume parsing, that every sound effect file exists, and that the game builds with itch.io-safe relative paths.

```sh
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m pytest
```

**Pre-push gate:** `npm install` enables the hook in `.githooks/pre-push`, which runs pytest and blocks `git push` if any test fails. To enable it manually, run `git config core.hooksPath .githooks`. To skip it in an emergency, use `git push --no-verify`.

## Settings

The gear icon (top right of the main menu and the game) opens a settings pop-up:

- **AUDIO**: volume of the song clips (changes apply live, even mid-clip).
- **SFX**: volume of the sound effects; releasing the slider plays a click at the new level.
- In a game, also **RESTART** (new run, same playlist) and **QUIT** (back to the main menu).

Volumes are saved in the browser (`localStorage`). A new player starts at 25% audio and 50% SFX. Close the pop-up with the × button, Esc, or a click outside it.

## Art

- **Life icons:** `public/assets/lives/alive-kanye.png` and `dead-kanye.png`, scaled to fit 120 px in the top bar. All three lives start as `alive-kanye.png`. Lives are lost from the right, and a lost life switches to `dead-kanye.png` at 75% size and dimmed. Living lives slowly wobble 15 degrees to each side; a dead one freezes at the tilt it had when it was lost. A missing image falls back to a drawn heart.
- **Playlist backgrounds:** `public/assets/playlists/1b.png`, `100m.png`, `1m.png`. They fill the 130 px square cards; non-square images are center-cropped. Use at least 480×480 so they stay sharp on high-DPI screens. A dark overlay keeps the text readable. A card without an image is drawn as a plain outline.

## Sound effects

Stored in `public/assets/audio/` and mapped in [src/sfx.ts](src/sfx.ts):

| Event | File |
| --- | --- |
| Correct answer | `ding.mp3` |
| START (main menu) | `menu-hit.mp3` |
| Any other button or playlist click (not SKIP, GIVE UP or the play button) | `peggle-peg-pop.mp3` |
| Wrong answer (before the last clip) | `osu-combo-break.wav` |
| Life lost: wrong answer on the last clip, or GIVE UP (only this sound plays) | `roblox-oof.mp3` |
| Playlist finished (results pop-up) | `roblox-victory.mp3` |
| Out of lives (game over pop-up) | `sad-trombone.mp3` |

To swap a sound, replace the file or change its path in `sfx.ts`. A test fails if any listed file is missing.

## Publishing to itch.io

```sh
npm run zip      # builds and creates kanye-song-guesser.zip from dist/
```

On itch.io: create a new project -> Kind of project: **HTML** -> upload the zip -> tick **This file will be played in the browser** -> viewport **800 × 600** (the game scales to fit, so other sizes also work).
