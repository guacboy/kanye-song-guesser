import Phaser from 'phaser';
import { COLORS, makeText } from '../theme';

const GLOW_PAD = 28;
const GLOW_MAX_BLUR = 22;
/** Pre-rendered glow sizes, from a thin line at the border (0) to the full glow (GLOW_STEPS - 1). */
const GLOW_STEPS = 16;
const GLOW_GROW_MS = 400;
const glowTexture = (step: number) => `card-glow-${step}`;

/**
 * Square playlist tile: optional background image, song count, stream label.
 * Hover inverts the colors like every other button; selection adds a white glow.
 */
export class PlaylistCard extends Phaser.GameObjects.Container {
  private glow: Phaser.GameObjects.Image;
  private overlay: Phaser.GameObjects.Rectangle;
  private texts: Phaser.GameObjects.Text[];
  private hasImage: boolean;
  private glowTween?: Phaser.Tweens.Tween;
  private isHovered = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    size: number,
    count: string,
    label: string,
    imageKey: string,
    onClick: () => void,
  ) {
    super(scene, x, y);
    PlaylistCard.ensureGlowTexture(scene, size);

    this.glow = scene.add.image(0, 0, glowTexture(0)).setVisible(false);
    this.add(this.glow);

    this.hasImage = scene.textures.exists(imageKey);
    if (this.hasImage) this.add(PlaylistCard.coverImage(scene, imageKey, size));

    // Darkens a background image so text stays readable; becomes the inverted fill on hover.
    this.overlay = scene.add.rectangle(0, 0, size, size, COLORS.bgNum, this.hasImage ? 0.45 : 0);
    const border = scene.add.rectangle(0, 0, size, size).setStrokeStyle(2, COLORS.textNum);
    this.texts = [
      makeText(scene, 0, -10, count, 30).setFontStyle('bold'),
      makeText(scene, 0, 24, label, 14),
    ];
    this.add([this.overlay, border, ...this.texts]);

    this.setSize(size, size);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => this.setHovered(true));
    this.on('pointerout', () => this.setHovered(false));
    // Phaser doesn't send pointerout when the cursor leaves the canvas from on top of an object.
    const clearHover = () => this.setHovered(false);
    scene.input.on(Phaser.Input.Events.GAME_OUT, clearHover);
    this.once(Phaser.GameObjects.Events.DESTROY, () => scene.input.off(Phaser.Input.Events.GAME_OUT, clearHover));
    this.on('pointerup', onClick);

    scene.add.existing(this);
  }

  setSelected(selected: boolean): this {
    if (selected === this.glow.visible) return this;
    this.glowTween?.remove();
    this.glowTween = undefined;
    this.glow.setVisible(selected);
    if (selected) this.growGlow();
    return this;
  }

  /** Spread the glow out from the border, then hand off to the idle pulse. */
  private growGlow(): void {
    this.glow.setTexture(glowTexture(0)).setAlpha(1);
    const progress = { t: 0 };
    this.glowTween = this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: GLOW_GROW_MS,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.glow.setTexture(glowTexture(Math.round(progress.t * (GLOW_STEPS - 1)))),
      onComplete: () => this.pulseGlow(),
    });
  }

  private pulseGlow(): void {
    this.glowTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: 0.55,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private setHovered(hovered: boolean): void {
    this.isHovered = hovered;
    if (this.isHovered) this.overlay.setFillStyle(COLORS.textNum, this.hasImage ? 0.85 : 1);
    else this.overlay.setFillStyle(COLORS.bgNum, this.hasImage ? 0.45 : 0);
    this.texts.forEach((t) => t.setColor(this.isHovered ? COLORS.bg : COLORS.text));
  }

  /** Scale the image to cover the square and crop the overflow (like CSS background-size: cover). */
  private static coverImage(scene: Phaser.Scene, key: string, size: number): Phaser.GameObjects.Image {
    const img = scene.add.image(0, 0, key);
    const scale = Math.max(size / img.width, size / img.height);
    const cw = size / scale;
    const ch = size / scale;
    return img.setScale(scale).setCrop((img.width - cw) / 2, (img.height - ch) / 2, cw, ch);
  }

  /**
   * White outer glow at each spread step, drawn once with canvas shadowBlur; the card area is cut out.
   * Drawn at 1× — it's a blur, so extra resolution wouldn't show.
   */
  private static ensureGlowTexture(scene: Phaser.Scene, size: number): void {
    if (scene.textures.exists(glowTexture(0))) return;
    const full = size + GLOW_PAD * 2;
    for (let step = 0; step < GLOW_STEPS; step++) {
      const tex = scene.textures.createCanvas(glowTexture(step), full, full)!;
      const ctx = tex.getContext();
      ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
      ctx.shadowBlur = 2 + (GLOW_MAX_BLUR - 2) * (step / (GLOW_STEPS - 1));
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) ctx.fillRect(GLOW_PAD, GLOW_PAD, size, size);
      ctx.shadowBlur = 0;
      ctx.clearRect(GLOW_PAD, GLOW_PAD, size, size);
      tex.refresh();
    }
  }
}
