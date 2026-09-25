import Phaser from 'phaser';
import { COLORS, RADIUS, makeText } from '../theme';
import { playSfx } from '../sfx';

/**
 * Outlined button: transparent fill + text-colored border.
 * On hover (or when selected) the colors invert: text-colored fill, background-colored label.
 */
/** Draws a button icon; `active` is true while hovered/selected. */
export type IconDraw = (g: Phaser.GameObjects.Graphics, color: number, active: boolean) => void;

export class Button extends Phaser.GameObjects.Container {
  private box: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private isEnabled = true;
  private isSelected = false;
  private isHovered = false;
  private isPressed = false;
  /** Fill + border color while hovered/selected. */
  private hoverColor: number = COLORS.textNum;
  /** No outline or fill; hover just recolors the label/icon with hoverColor. */
  private borderless = false;
  private icon?: { g: Phaser.GameObjects.Graphics; draw: IconDraw };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    width = 260,
    height = 50,
    fontSize = 20,
    private circle = false,
    clickSound = true,
  ) {
    super(scene, x, y);
    this.box = scene.add.graphics();
    this.label = makeText(scene, 0, 0, text, fontSize);
    this.add([this.box, this.label]);

    this.setSize(width, height);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => {
      this.isHovered = true;
      this.refresh();
    });
    this.on('pointerout', () => this.resetHover());
    // Phaser doesn't send pointerout when the cursor leaves the canvas from on top of an object.
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.resetHover, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => scene.input.off(Phaser.Input.Events.GAME_OUT, this.resetHover, this));
    // Only a press that starts on this button counts. Phaser also reports mouse-ups from outside the
    // canvas (e.g. on a dropdown suggestion above it), which must not click whatever is underneath.
    this.on('pointerdown', () => {
      this.isPressed = true;
    });
    this.on('pointerup', () => {
      const wasPressed = this.isPressed;
      this.isPressed = false;
      if (!wasPressed || !this.isEnabled) return;
      if (clickSound) playSfx(scene, 'click');
      onClick();
    });

    this.refresh();
    scene.add.existing(this);
  }

  setLabel(text: string, fontSize?: number): this {
    this.label.setText(text);
    if (fontSize) this.label.setFontSize(fontSize);
    return this;
  }

  /** Draw an icon instead of (or with) the label; `draw` gets the current foreground color. */
  setIcon(draw: IconDraw): this {
    const g = this.scene.add.graphics();
    this.add(g);
    this.icon = { g, draw };
    this.refresh();
    return this;
  }

  /** Icon-only look: no outline or fill, and hover recolors the label/icon to `hoverColor`. */
  setBorderless(hoverColor: number): this {
    this.borderless = true;
    this.hoverColor = hoverColor;
    this.refresh();
    return this;
  }

  setHoverColor(color: number): this {
    this.hoverColor = color;
    this.refresh();
    return this;
  }

  /** Nudge the label, e.g. to optically center a glyph like ▶ whose visual weight is off-center. */
  setLabelOffset(dx: number, dy = 0): this {
    this.label.setPosition(dx, dy);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.isEnabled = enabled;
    if (this.input) this.input.cursor = enabled ? 'pointer' : 'default';
    this.refresh();
    return this;
  }

  setSelected(selected: boolean): this {
    this.isSelected = selected;
    this.refresh();
    return this;
  }

  /** Drop hover/press state, e.g. when a pop-up takes over input while the cursor is on the button. */
  resetHover(): void {
    this.isHovered = false;
    this.isPressed = false;
    this.refresh();
  }

  private refresh(): void {
    const inverted = this.isEnabled && (this.isHovered || this.isSelected);
    const { width: w, height: h } = this;
    this.box.clear();
    if (this.borderless) {
      const fg = inverted ? this.hoverColor : COLORS.textNum;
      this.label.setColor(`#${fg.toString(16).padStart(6, '0')}`);
      this.icon?.g.clear();
      this.icon?.draw(this.icon.g, fg, inverted);
      this.setAlpha(this.isEnabled ? 1 : 0.35);
      return;
    }
    if (this.circle) {
      const r = Math.min(w, h) / 2;
      if (inverted) this.box.fillStyle(this.hoverColor).fillCircle(0, 0, r);
      this.box.lineStyle(2, inverted ? this.hoverColor : COLORS.textNum).strokeCircle(0, 0, r);
    } else {
      if (inverted) this.box.fillStyle(this.hoverColor).fillRoundedRect(-w / 2, -h / 2, w, h, RADIUS);
      this.box.lineStyle(2, inverted ? this.hoverColor : COLORS.textNum).strokeRoundedRect(-w / 2, -h / 2, w, h, RADIUS);
    }
    this.label.setColor(inverted ? COLORS.bg : COLORS.text);
    if (this.icon) {
      this.icon.g.clear();
      this.icon.draw(this.icon.g, inverted ? COLORS.bgNum : COLORS.textNum, inverted);
    }
    this.setAlpha(this.isEnabled ? 1 : 0.35);
  }
}
