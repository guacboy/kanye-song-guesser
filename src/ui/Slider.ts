import Phaser from 'phaser';
import { COLORS } from '../theme';

const TRACK_H = 6;
const KNOB_R = 9;

/** Horizontal 0..1 slider: click or drag anywhere on the track. */
export class Slider extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  private dragging = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private trackW: number,
    private value: number,
    private onChange: (value: number) => void,
    private onRelease?: () => void,
  ) {
    super(scene, x, y);
    this.g = scene.add.graphics();
    this.add(this.g);
    this.setSize(trackW + KNOB_R * 2, KNOB_R * 3);
    this.setInteractive({ useHandCursor: true });

    this.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.setFromPointer(p);
    });
    // Track the drag on the whole scene so it keeps working outside the slider.
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
      scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
      scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    });

    this.redraw();
    scene.add.existing(this);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.dragging) this.setFromPointer(p);
  }

  private onUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.onRelease?.();
  }

  private setFromPointer(p: Phaser.Input.Pointer): void {
    const world = p.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    const local = this.getWorldTransformMatrix().applyInverse(world.x, world.y);
    const v = Phaser.Math.Clamp((local.x + this.trackW / 2) / this.trackW, 0, 1);
    if (v === this.value) return;
    this.value = v;
    this.redraw();
    this.onChange(v);
  }

  private redraw(): void {
    const g = this.g;
    const left = -this.trackW / 2;
    const filled = this.trackW * this.value;
    g.clear();
    g.fillStyle(COLORS.dim).fillRoundedRect(left, -TRACK_H / 2, this.trackW, TRACK_H, TRACK_H / 2);
    if (filled >= TRACK_H) g.fillStyle(COLORS.textNum).fillRoundedRect(left, -TRACK_H / 2, filled, TRACK_H, TRACK_H / 2);
    g.fillStyle(COLORS.textNum).fillCircle(left + filled, 0, KNOB_R);
  }
}
