import Phaser from 'phaser';
import {
  CLIP_LENGTHS,
  COLORS,
  MAX_LIVES,
  RADIUS,
  RENDER_SCALE,
  REVEAL_CLIP,
  WIDTH,
  fitCamera,
  makeText,
} from '../theme';
import { SONGS, Song, Tier, songsForTier } from '../data/songs';
import { formatCredits, isCorrect } from '../logic/search';
import { Button } from '../ui/Button';
import { GuessInput } from '../ui/GuessInput';
import { roundedCoverTexture } from '../ui/roundedTexture';
import { albumColor, hideBackdrop, hideDim, showBackdrop, showDim } from '../ui/backdrop';
import { LIFE_TEXTURE } from './BootScene';
import type { EndReason } from './ResultsScene';
import { playSfx } from '../sfx';
import { enterScene, goTo } from '../transition';

type Phase = 'loading' | 'guessing' | 'revealed';

const CX = WIDTH / 2;
const TOP_Y = 36; // QUIT, lives and song counter share this row
const LIFE_SIZE = 30;
const LIFE_GAP = 40;

// Reveal: album art centered where the progress bar sits while guessing; title + credits below it,
// and the bar slides down under them.
const ART_Y = 150;
const ART_SIZE = 140;
const TITLE_Y = ART_Y + ART_SIZE / 2 + 22;
const CREDITS_Y = TITLE_Y + 22;
const BAR_W = 360;
const BAR_H = 8;
const BAR_IDLE_Y = ART_Y - BAR_H / 2;
const BAR_REVEAL_Y = CREDITS_Y + 22;
const TICK_H = 6; // checkpoint line under the bar
const REVEAL_MS = 450;

// Answer row: text box with the skip/next button to its right.
const ROW_Y = 335;
const ROW_H = 40; // .guess-input height in style.css
const GUESS_W = 300; // .guess width in style.css
const SKIP_W = 110;
const ROW_GAP = 8;
const ROW_LEFT = CX - (GUESS_W + ROW_GAP + SKIP_W) / 2;

const PLAY_Y = 410;
const PLAY_D = 56;
const FEEDBACK_Y = 470;

const MAX_CLIP = CLIP_LENGTHS[CLIP_LENGTHS.length - 1];
/** How visible the game stays behind the results pop-up. */
const DIMMED_ALPHA = 0.3;

const songKey = (song: Song) => `song:${song.file}`;
const coverKey = (song: Song) => `cover:${song.cover}`;

export class GameScene extends Phaser.Scene {
  private tier!: Tier;
  private queue: Song[] = [];
  private song?: Song;
  private phase: Phase = 'loading';
  private attempt = 0;
  private lives = MAX_LIVES;
  private score = 0;
  private played = 0;
  /** Songs in this run; drops if a file fails to load. */
  private total = 0;
  private alive = false;
  private ended = false;
  private pending = new Map<string, Promise<boolean>>();

  private clip?: Phaser.Sound.BaseSound;
  private clipLen = 0;
  private clipStartedAt = 0;

  private lifeIcons: Phaser.GameObjects.Image[] = [];
  private playBtn!: Button;
  private bar!: Phaser.GameObjects.Graphics;
  private barY = BAR_IDLE_Y;
  private tickLabel!: Phaser.GameObjects.Text;
  private revealView?: Phaser.GameObjects.Container;
  private guess!: GuessInput;
  private skipBtn!: Button;
  private feedback!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  init({ tier }: { tier: Tier }): void {
    this.tier = tier;
    this.queue = Phaser.Utils.Array.Shuffle([...songsForTier(tier)]);
    this.song = undefined;
    this.phase = 'loading';
    this.attempt = 0;
    this.lives = MAX_LIVES;
    this.score = 0;
    this.played = 0;
    this.total = this.queue.length;
    this.pending.clear();
    this.alive = true;
    this.ended = false;
    this.barY = BAR_IDLE_Y;
    this.revealView = undefined;
  }

  create(): void {
    fitCamera(this);
    // Top bar: QUIT | lives (centered) | songs counter
    new Button(this, 70, TOP_Y, 'QUIT', () => goTo(this, 'Menu'), 110, 36, 14);
    this.progressText = makeText(this, WIDTH - 70, TOP_Y, '', 18);
    this.lifeIcons = [];
    for (let i = 0; i < MAX_LIVES; i++) {
      const img = this.add.image(CX + (i - (MAX_LIVES - 1) / 2) * LIFE_GAP, TOP_Y, LIFE_TEXTURE);
      img.setScale(LIFE_SIZE / Math.max(img.width, img.height));
      this.lifeIcons.push(img);
    }

    // Clip progress + the current checkpoint's label (positioned every frame in drawBar)
    this.bar = this.add.graphics();
    this.tickLabel = makeText(this, 0, 0, '', 11);

    // Answer row: text box, then skip/next
    this.guess = new GuessInput(this, ROW_LEFT + GUESS_W / 2, ROW_Y, SONGS, (g) => this.submitGuess(g));
    const skipX = ROW_LEFT + GUESS_W + ROW_GAP + SKIP_W / 2;
    // Silent button: onSkip picks the sound (click, or just the oof for GIVE UP).
    this.skipBtn = new Button(this, skipX, ROW_Y, '', () => this.onSkip(), SKIP_W, ROW_H, 14, false, false);

    // Replay: round button with just the play symbol. ▶'s weight sits left of its box, so nudge it right.
    this.playBtn = new Button(this, CX, PLAY_Y, '▶', () => this.onPlay(), PLAY_D, PLAY_D, 20, true, false);
    this.playBtn.setLabelOffset(2, -1);

    this.feedback = makeText(this, CX, FEEDBACK_Y, '', 18, COLORS.muted).setAlign('center');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      this.stopClip();
      hideBackdrop();
      hideDim();
    });

    this.refreshHud();
    enterScene(this);
    void this.nextSong();
  }

  update(): void {
    this.drawBar(this.time.now);
  }

  // ---------- flow ----------

  private async nextSong(): Promise<void> {
    this.phase = 'loading';
    this.attempt = 0;
    this.stopClip();
    this.hideReveal();
    this.setControls();
    this.feedback.setText('Loading…').setColor(COLORS.muted);

    while (this.queue.length > 0) {
      const song = this.queue.shift()!;
      const ok = await this.loadSong(song);
      if (!this.alive) return;
      if (ok) {
        this.song = song;
        this.played++;
        this.refreshHud();
        if (this.queue[0]) void this.loadSong(this.queue[0]); // preload the next one
        this.startAttempt();
        return;
      }
      console.warn(`[game] could not load ${song.file}, skipping "${song.title}"`);
      this.total--;
      this.refreshHud();
    }
    this.endGame(this.played === 0 ? 'no-audio' : 'finished');
  }

  private startAttempt(): void {
    this.phase = 'guessing';
    this.feedback.setText('');
    this.setControls();
    this.guess.focus();
    this.playClip();
  }

  private submitGuess(guess: string): void {
    if (this.phase !== 'guessing' || !this.song) return;
    if (isCorrect(this.song, guess)) {
      this.score++;
      playSfx(this, 'correct');
      this.reveal();
    } else {
      // On the last clip this also costs a life, and advance() plays only the oof.
      if (!this.onLastClip()) playSfx(this, 'incorrect');
      this.advance(`✗  ${guess}`);
    }
  }

  private onLastClip(): boolean {
    return this.attempt >= CLIP_LENGTHS.length - 1;
  }

  private onSkip(): void {
    // SKIP is silent; GIVE UP only plays the oof (from advance()); NEXT/RESULTS click.
    if (this.phase === 'revealed') playSfx(this, 'click');
    if (this.phase === 'guessing') this.advance('Skipped');
    else if (this.phase === 'revealed') {
      if (this.lives <= 0) this.endGame('out-of-lives');
      else void this.nextSong();
    }
  }

  /** Wrong guess or skip: unlock the next clip length, or lose a life after the last one. */
  private advance(message: string): void {
    this.attempt++;
    if (this.attempt >= CLIP_LENGTHS.length) {
      this.attempt = CLIP_LENGTHS.length - 1;
      this.lives--;
      playSfx(this, 'lifeLost');
      this.reveal();
      return;
    }
    this.startAttempt();
    this.feedback.setText(message).setColor(COLORS.muted);
  }

  private reveal(): void {
    const song = this.song!;
    this.phase = 'revealed';
    this.setControls();
    this.refreshHud();
    this.feedback.setText('');
    this.showReveal(song);
    this.playClip();
  }

  /** Dim and freeze the game, then pop the results up on top (ResultsScene). */
  private endGame(reason: EndReason): void {
    if (this.ended) return;
    this.ended = true;
    this.stopClip();
    this.feedback.setText('');
    this.input.enabled = false;
    this.guess.setEnabled(false);
    // The answer box is a DOM element drawn above the canvas, so fade it out rather than dim it.
    this.tweens.add({ targets: this.guess.element, alpha: 0, duration: 200 });
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    this.tweens.add({ targets: cam, alpha: DIMMED_ALPHA, zoom: RENDER_SCALE, duration: 300, ease: 'Cubic.easeOut' });
    showDim();
    this.scene.launch('Results', { tier: this.tier, score: this.score, played: this.played, reason });
  }

  // ---------- UI state ----------

  private setControls(): void {
    const guessing = this.phase === 'guessing';
    this.guess.setEnabled(guessing);
    if (!guessing) this.guess.clear();
    this.playBtn.setEnabled(this.phase !== 'loading');

    if (this.phase === 'revealed') {
      this.skipBtn.setLabel(this.lives <= 0 ? 'RESULTS' : 'NEXT', 14).setEnabled(true);
    } else {
      const last = this.onLastClip();
      this.skipBtn.setLabel(last ? 'GIVE UP' : 'SKIP', 14).setEnabled(guessing);
    }
  }

  private refreshHud(): void {
    this.lifeIcons.forEach((img, i) => img.setAlpha(i < this.lives ? 1 : 0.15));
    this.progressText.setText(`${this.played} / ${this.total}`);
  }

  private drawBar(now: number): void {
    const g = this.bar;
    const x = CX - BAR_W / 2;
    const y = this.barY;
    const revealed = this.phase === 'revealed';
    // To scale: 0..8s while guessing, 0..15s once revealed.
    const span = revealed ? REVEAL_CLIP : MAX_CLIP;
    const frac = (sec: number) => Math.min(sec / span, 1);
    const current = CLIP_LENGTHS[this.attempt];

    g.clear();
    g.fillStyle(COLORS.dim).fillRect(x, y, (revealed ? 1 : frac(current)) * BAR_W, BAR_H);
    if (this.clip?.isPlaying) {
      const played = Math.min((now - this.clipStartedAt) / 1000, this.clipLen);
      g.fillStyle(COLORS.textNum).fillRect(x, y, frac(played) * BAR_W, BAR_H);
    }
    g.lineStyle(2, COLORS.textNum).strokeRect(x, y, BAR_W, BAR_H);

    // Only the current checkpoint is marked: a short line under the bar and its length.
    this.tickLabel.setVisible(!revealed);
    if (!revealed) {
      const tx = x + frac(current) * BAR_W;
      g.lineStyle(1, COLORS.textNum).lineBetween(tx, y + BAR_H, tx, y + BAR_H + TICK_H);
      this.tickLabel.setText(`${current}s`).setPosition(tx, y + BAR_H + TICK_H + 9);
    }
  }

  // ---------- reveal ----------

  /** Bar slides down; album art, title and credits fade in where the bar was; page tints to the album. */
  private showReveal(song: Song): void {
    this.revealView?.destroy();
    const view = this.add.container(CX, 0).setAlpha(0);

    const hasCover = !!song.cover && this.textures.exists(coverKey(song));
    if (hasCover) {
      const key = roundedCoverTexture(this, coverKey(song), ART_SIZE);
      view.add(this.add.image(0, ART_Y, key).setScale(1 / RENDER_SCALE));
      const color = albumColor(this, coverKey(song));
      if (color) showBackdrop(color);
    } else {
      const half = ART_SIZE / 2;
      const placeholder = this.add.graphics();
      placeholder.lineStyle(2, COLORS.textNum).strokeRoundedRect(-half, ART_Y - half, ART_SIZE, ART_SIZE, RADIUS);
      view.add([placeholder, makeText(this, 0, ART_Y, '♪', 48, COLORS.muted)]);
    }
    view.add([
      makeText(this, 0, TITLE_Y, song.title, 20).setFontStyle('bold'),
      makeText(this, 0, CREDITS_Y, `${formatCredits(song)}  •  ${song.album}`, 14, COLORS.muted),
    ]);
    this.revealView = view;

    this.tweens.killTweensOf(this);
    this.tweens.add({ targets: this, barY: BAR_REVEAL_Y, duration: REVEAL_MS, ease: 'Cubic.easeInOut' });
    view.setScale(0.92);
    this.tweens.add({
      targets: view,
      alpha: 1,
      scale: 1,
      delay: REVEAL_MS * 0.6, // after the bar has mostly passed the title
      duration: REVEAL_MS,
      ease: 'Cubic.easeOut',
    });
  }

  /** Reverse of showReveal: art fades out, bar slides back up, tint fades. */
  private hideReveal(): void {
    const view = this.revealView;
    if (!view) return;
    this.revealView = undefined;
    hideBackdrop();
    this.tweens.killTweensOf(view);
    this.tweens.add({ targets: view, alpha: 0, duration: 200, onComplete: () => view.destroy() });
    this.tweens.killTweensOf(this);
    this.tweens.add({ targets: this, barY: BAR_IDLE_Y, duration: 300, ease: 'Cubic.easeInOut' });
  }

  // ---------- audio ----------

  private loadSong(song: Song): Promise<boolean> {
    const key = songKey(song);
    if (this.cache.audio.exists(key)) return Promise.resolve(true);
    const existing = this.pending.get(key);
    if (existing) return existing;

    const promise = new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        this.load.off(`filecomplete-audio-${key}`, onOk);
        this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onErr);
        this.load.off(Phaser.Loader.Events.COMPLETE, onBatchDone);
        this.pending.delete(key);
        resolve(ok);
      };
      const onOk = () => done(true);
      const onErr = (file: Phaser.Loader.File) => {
        if (file.key === key) done(false);
      };
      // Decode failures don't emit FILE_LOAD_ERROR, so also settle when the batch finishes.
      const onBatchDone = () => done(this.cache.audio.exists(key));
      this.load.on(`filecomplete-audio-${key}`, onOk);
      this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onErr);
      this.load.on(Phaser.Loader.Events.COMPLETE, onBatchDone);
      this.load.audio(key, song.file);
      // Cover art rides along in the same batch; a missing cover just shows the placeholder.
      if (song.cover && !this.textures.exists(coverKey(song))) this.load.image(coverKey(song), song.cover);
      this.load.start();
    });
    this.pending.set(key, promise);
    return promise;
  }

  /** Replay button: play the clip and send a ring out from the button. */
  private onPlay(): void {
    this.playClip();
    const ring = this.add.graphics({ x: CX, y: PLAY_Y });
    ring.lineStyle(2, COLORS.textNum).strokeCircle(0, 0, PLAY_D / 2);
    this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 550, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    this.tweens.add({ targets: this.playBtn, scale: 0.9, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Plays the current attempt's clip, or REVEAL_CLIP seconds once the song is revealed. */
  private playClip(): void {
    if (!this.song || this.phase === 'loading') return;
    const length = this.phase === 'revealed' ? REVEAL_CLIP : CLIP_LENGTHS[this.attempt];
    this.stopClip();

    const clip = this.sound.add(songKey(this.song));
    clip.addMarker({ name: 'clip', start: this.song.start ?? 0, duration: length });
    clip.play('clip');
    this.clip = clip;
    this.clipLen = length;
    this.clipStartedAt = this.time.now;
  }

  private stopClip(): void {
    this.clip?.stop();
    this.clip?.destroy();
    this.clip = undefined;
  }
}
