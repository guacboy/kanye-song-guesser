import Phaser from 'phaser';
import { CLIP_LENGTHS, COLORS, MAX_LIVES, WIDTH, fitCamera, makeText } from '../theme';
import { SONGS, Song, Tier, songsForTier } from '../data/songs';
import { formatCredits, isCorrect } from '../logic/search';
import { Button } from '../ui/Button';
import { GuessInput } from '../ui/GuessInput';
import { LIFE_TEXTURE } from './BootScene';
import type { EndReason } from './GameOverScene';

type Phase = 'loading' | 'guessing' | 'revealed';

const CX = WIDTH / 2;
const LIVES_Y = 140;
const PLAY_Y = 225;
const BAR_Y = 272;
const BAR_W = 360;
const GUESS_Y = 340;
const SKIP_Y = 420;
const FEEDBACK_Y = 490;
const MAX_CLIP = CLIP_LENGTHS[CLIP_LENGTHS.length - 1];

const songKey = (song: Song) => `song:${song.file}`;

export class GameScene extends Phaser.Scene {
  private tier!: Tier;
  private queue: Song[] = [];
  private song?: Song;
  private phase: Phase = 'loading';
  private attempt = 0;
  private lives = MAX_LIVES;
  private score = 0;
  private played = 0;
  private alive = false;
  private pending = new Map<string, Promise<boolean>>();

  private clip?: Phaser.Sound.BaseSound;
  private clipLen = 0;
  private clipStartedAt = 0;

  private lifeIcons: Phaser.GameObjects.Image[] = [];
  private playBtn!: Button;
  private bar!: Phaser.GameObjects.Graphics;
  private guess!: GuessInput;
  private skipBtn!: Button;
  private feedback!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;

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
    this.pending.clear();
    this.alive = true;
  }

  create(): void {
    fitCamera(this);
    new Button(this, 70, 36, '← MENU', () => this.scene.start('Menu'), 110, 36, 14);
    this.scoreText = makeText(this, WIDTH - 70, 36, '', 18);

    // Lives
    this.lifeIcons = [];
    for (let i = 0; i < MAX_LIVES; i++) {
      const img = this.add.image(CX + (i - (MAX_LIVES - 1) / 2) * 64, LIVES_Y, LIFE_TEXTURE);
      img.setScale(48 / Math.max(img.width, img.height));
      this.lifeIcons.push(img);
    }

    // Current clip length + replay
    this.playBtn = new Button(this, CX, PLAY_Y, '', () => this.playClip(), 200, 56, 24);
    this.bar = this.add.graphics();

    // Answer box
    this.guess = new GuessInput(this, CX, GUESS_Y, SONGS, (g) => this.submitGuess(g));

    // Skip / next
    this.skipBtn = new Button(this, CX, SKIP_Y, '', () => this.onSkip(), 240, 50, 18);

    this.feedback = makeText(this, CX, FEEDBACK_Y, '', 18, COLORS.muted).setAlign('center');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      this.stopClip();
    });

    this.refreshHud();
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
    this.setControls();
    this.feedback.setText('Loading…').setColor(COLORS.muted);

    while (this.queue.length > 0) {
      const song = this.queue.shift()!;
      const ok = await this.loadSong(song);
      if (!this.alive) return;
      if (ok) {
        this.song = song;
        this.played++;
        if (this.queue[0]) void this.loadSong(this.queue[0]); // preload the next one
        this.startAttempt();
        return;
      }
      console.warn(`[game] could not load ${song.file}, skipping "${song.title}"`);
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
      this.reveal(true);
    } else {
      this.advance(`✗  ${guess}`);
    }
  }

  private onSkip(): void {
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
      this.reveal(false);
      return;
    }
    this.startAttempt();
    this.feedback.setText(message).setColor(COLORS.muted);
  }

  private reveal(correct: boolean): void {
    const song = this.song!;
    this.phase = 'revealed';
    this.setControls();
    this.refreshHud();
    this.feedback
      .setText(`${correct ? '✓' : '✗'}  ${song.title}\n${formatCredits(song)} · ${song.album}`)
      .setColor(correct ? COLORS.text : COLORS.muted);
    // Reward / consolation: play the longest clip.
    this.playClip(MAX_CLIP);
  }

  private endGame(reason: EndReason): void {
    this.stopClip();
    this.scene.start('GameOver', { tier: this.tier, score: this.score, played: this.played, reason });
  }

  // ---------- UI state ----------

  private setControls(): void {
    const guessing = this.phase === 'guessing';
    const len = CLIP_LENGTHS[this.attempt];

    this.guess.setEnabled(guessing);
    if (this.phase !== 'guessing') this.guess.clear();

    this.playBtn.setEnabled(this.phase !== 'loading');
    this.playBtn.setLabel(`▶  ${this.phase === 'revealed' ? MAX_CLIP : len}s`);

    if (this.phase === 'revealed') {
      this.skipBtn.setLabel(this.lives <= 0 ? 'RESULTS →' : 'NEXT SONG →').setEnabled(true);
    } else {
      const next = CLIP_LENGTHS[this.attempt + 1];
      this.skipBtn.setLabel(next !== undefined ? `SKIP (+${next - len}s)` : 'GIVE UP').setEnabled(guessing);
    }
  }

  private refreshHud(): void {
    this.lifeIcons.forEach((img, i) => img.setAlpha(i < this.lives ? 1 : 0.15));
    this.scoreText.setText(`Score: ${this.score}`);
  }

  private drawBar(now: number): void {
    const g = this.bar;
    const x = CX - BAR_W / 2;
    const h = 8;
    const unlocked = this.phase === 'revealed' ? MAX_CLIP : CLIP_LENGTHS[this.attempt];

    g.clear();
    g.fillStyle(COLORS.dim).fillRect(x, BAR_Y, (unlocked / MAX_CLIP) * BAR_W, h);
    if (this.clip?.isPlaying) {
      const played = Math.min((now - this.clipStartedAt) / 1000, this.clipLen);
      g.fillStyle(COLORS.textNum).fillRect(x, BAR_Y, (played / MAX_CLIP) * BAR_W, h);
    }
    g.lineStyle(1, COLORS.mutedNum);
    for (const len of CLIP_LENGTHS.slice(0, -1)) {
      const tx = x + (len / MAX_CLIP) * BAR_W;
      g.lineBetween(tx, BAR_Y, tx, BAR_Y + h);
    }
    g.lineStyle(2, COLORS.textNum).strokeRect(x, BAR_Y, BAR_W, h);
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
      this.load.start();
    });
    this.pending.set(key, promise);
    return promise;
  }

  private playClip(length = CLIP_LENGTHS[this.attempt]): void {
    if (!this.song || this.phase === 'loading') return;
    if (this.phase === 'revealed') length = MAX_CLIP;
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
