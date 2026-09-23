import Phaser from 'phaser';
import { COLORS, makeText } from '../theme';

/**
 * Outlined button: transparent fill + text-colored border.
 * On hover (or when selected) the colors invert: text-colored fill, background-colored label.
 */
export class Button extends Phaser.GameObjects.Container {
  private box: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private isEnabled = true;
  private isSelected = false;
  private isHovered = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    width = 260,
    height = 50,
    fontSize = 20,
  ) {
    super(scene, x, y);
    this.box = scene.add.rectangle(0, 0, width, height, COLORS.textNum, 0).setStrokeStyle(2, COLORS.textNum);
    this.label = makeText(scene, 0, 0, text, fontSize);
    this.add([this.box, this.label]);

    this.setSize(width, height);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => {
      this.isHovered = true;
      this.refresh();
    });
    this.on('pointerout', () => {
      this.isHovered = false;
      this.refresh();
    });
    this.on('pointerup', () => {
      if (this.isEnabled) onClick();
    });

    scene.add.existing(this);
  }

  setLabel(text: string): this {
    this.label.setText(text);
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

  private refresh(): void {
    const inverted = this.isEnabled && (this.isHovered || this.isSelected);
    this.box.setFillStyle(COLORS.textNum, inverted ? 1 : 0);
    this.label.setColor(inverted ? COLORS.bg : COLORS.text);
    this.setAlpha(this.isEnabled ? 1 : 0.35);
  }
}
