import Phaser from 'phaser';
import { COLORS, RENDER_SCALE, makeText } from '../theme';

const GLOW_TEXTURE = 'card-glow';
const GLOW_PAD = 28;

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

    this.glow = scene.add.image(0, 0, GLOW_TEXTURE).setScale(1 / RENDER_SCALE).setVisible(false);
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
    this.on('pointerup', onClick);

    scene.add.existing(this);
  }

  setSelected(selected: boolean): this {
    this.glow.setVisible(selected);
    this.glowTween?.remove();
    this.glowTween = undefined;
    if (selected) {
      this.glow.setAlpha(1);
      this.glowTween = this.scene.tweens.add({
        targets: this.glow,
        alpha: 0.55,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    return this;
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

  /** White outer glow drawn once with canvas shadowBlur; the card area itself is cut out. */
  private static ensureGlowTexture(scene: Phaser.Scene, size: number): void {
    if (scene.textures.exists(GLOW_TEXTURE)) return;
    const s = RENDER_SCALE;
    const pad = GLOW_PAD * s;
    const inner = size * s;
    const tex = scene.textures.createCanvas(GLOW_TEXTURE, inner + pad * 2, inner + pad * 2)!;
    const ctx = tex.getContext();
    ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowBlur = 22 * s;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) ctx.fillRect(pad, pad, inner, inner);
    ctx.shadowBlur = 0;
    ctx.clearRect(pad, pad, inner, inner);
    tex.refresh();
  }
}
