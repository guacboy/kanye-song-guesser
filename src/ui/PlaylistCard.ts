import Phaser from 'phaser';
import { COLORS, RADIUS, RENDER_SCALE, makeText } from '../theme';
import { roundedCoverTexture } from './roundedTexture';

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
  private box: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[];
  private hasImage: boolean;
  private glowTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private size: number,
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
    if (this.hasImage) {
      const key = roundedCoverTexture(scene, imageKey, size);
      this.add(scene.add.image(0, 0, key).setScale(1 / RENDER_SCALE));
    }

    // Tint over the image (so text stays readable) + border; becomes the inverted fill on hover.
    this.box = scene.add.graphics();
    this.texts = [
      makeText(scene, 0, -size * 0.0625, count, Math.round(size * 0.19)).setFontStyle('bold'),
      makeText(scene, 0, size * 0.15, label, Math.round(size * 0.09)),
    ];
    this.add([this.box, ...this.texts]);

    this.setSize(size, size);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => this.setHovered(true));
    this.on('pointerout', () => this.setHovered(false));
    // Phaser doesn't send pointerout when the cursor leaves the canvas from on top of an object.
    const clearHover = () => this.setHovered(false);
    scene.input.on(Phaser.Input.Events.GAME_OUT, clearHover);
    this.once(Phaser.GameObjects.Events.DESTROY, () => scene.input.off(Phaser.Input.Events.GAME_OUT, clearHover));
    // Only a press that starts on the card counts (see Button).
    let pressed = false;
    this.on('pointerdown', () => (pressed = true));
    this.on('pointerout', () => (pressed = false));
    this.on('pointerup', () => {
      if (pressed) onClick();
      pressed = false;
    });

    this.setHovered(false);
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
    const half = this.size / 2;
    this.box.clear();
    if (hovered) this.box.fillStyle(COLORS.textNum, this.hasImage ? 0.85 : 1);
    else this.box.fillStyle(COLORS.bgNum, this.hasImage ? 0.45 : 0);
    this.box.fillRoundedRect(-half, -half, this.size, this.size, RADIUS);
    this.box.lineStyle(2, COLORS.textNum).strokeRoundedRect(-half, -half, this.size, this.size, RADIUS);
    this.texts.forEach((t) => t.setColor(hovered ? COLORS.bg : COLORS.text));
  }

  /**
   * White outer glow at each spread step, drawn once with canvas shadowBlur; the card area is cut out.
   * Drawn at 1x: it's a blur, so extra resolution wouldn't show.
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
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.roundRect(GLOW_PAD, GLOW_PAD, size, size, RADIUS);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.roundRect(GLOW_PAD, GLOW_PAD, size, size, RADIUS);
      ctx.fill();
      tex.refresh();
    }
  }
}
