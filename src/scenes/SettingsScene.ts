import Phaser from 'phaser';
import { COLORS, HEIGHT, RADIUS, WIDTH, fitCamera, makeText } from '../theme';
import type { Tier } from '../data/songs';
import { Button } from '../ui/Button';
import { Slider } from '../ui/Slider';
import { hideDim } from '../ui/backdrop';
import { goTo } from '../transition';
import { playSfx } from '../sfx';
import { getVolume, setVolume, type VolumeKind } from '../settings';
import { volumeLabel } from '../logic/settings';

/** A scene that can host the settings pop-up: it dims and freezes itself while it's open. */
export interface OverlayHost {
  setOverlayOpen(open: boolean): void;
}

export interface SettingsData {
  host: 'Menu' | 'Game';
  /** In game: the playlist, for RESTART. */
  tier?: Tier;
}

const PANEL_W = 360;
const ROW_GAP = 50;

/** Settings pop-up (volume sliders; in game also RESTART and QUIT), launched over Menu or Game. */
export class SettingsScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private host!: Phaser.Scene & OverlayHost;
  private closing = false;

  constructor() {
    super('Settings');
  }

  create({ host, tier }: SettingsData): void {
    fitCamera(this);
    this.closing = false;
    this.input.enabled = true; // close() turned it off; the plugin keeps that across launches
    this.host = this.scene.get(host) as Phaser.Scene & OverlayHost;
    this.host.setOverlayOpen(true);
    const inGame = host === 'Game';
    const panelH = inGame ? 310 : 210;
    const top = -panelH / 2;

    // Click outside the panel to close (only if the press also started outside, so a slider
    // drag released off the panel doesn't close it).
    let outsidePress = false;
    const catcher = this.add.zone(WIDTH / 2, HEIGHT / 2, WIDTH * 2, HEIGHT * 2).setInteractive();
    catcher.on('pointerdown', () => (outsidePress = true));
    catcher.on('pointerup', () => {
      if (outsidePress) this.close();
      outsidePress = false;
    });
    const onEsc = () => this.close();
    this.input.keyboard?.on('keydown-ESC', onEsc);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ESC', onEsc));

    const panel = this.add.container(WIDTH / 2, HEIGHT / 2);
    const box = this.add.graphics();
    box.fillStyle(COLORS.bgNum).fillRoundedRect(-PANEL_W / 2, top, PANEL_W, panelH, RADIUS * 1.5);
    box.lineStyle(2, COLORS.textNum).strokeRoundedRect(-PANEL_W / 2, top, PANEL_W, panelH, RADIUS * 1.5);
    panel.add([
      this.add.zone(0, 0, PANEL_W, panelH).setInteractive(), // swallows clicks so they don't reach the catcher
      box,
      makeText(this, 0, top + 34, 'SETTINGS', 22).setFontStyle('bold'),
      new Button(this, PANEL_W / 2 - 26, top + 26, '×', () => this.close(), 40, 40, 30).setBorderless(COLORS.dangerNum),
    ]);

    const firstRow = top + 88;
    this.addVolumeRow(panel, 'AUDIO', 'music', firstRow);
    this.addVolumeRow(panel, 'SFX', 'sfx', firstRow + ROW_GAP);

    if (inGame) {
      const btnY = firstRow + ROW_GAP * 2 + 16;
      panel.add([
        new Button(this, 0, btnY, 'RESTART', () => this.leave('Game', { tier }), 170, 40, 14),
        new Button(this, 0, btnY + 54, 'QUIT', () => this.leave('Menu'), 170, 40, 14),
      ]);
    }
    this.panel = panel;

    panel.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
  }

  private addVolumeRow(panel: Phaser.GameObjects.Container, label: string, kind: VolumeKind, y: number): void {
    const edge = PANEL_W / 2 - 28;
    const pct = makeText(this, edge, y, volumeLabel(getVolume(kind)), 13, COLORS.muted).setOrigin(1, 0.5);
    const slider = new Slider(
      this,
      12,
      y,
      170,
      getVolume(kind),
      (v) => {
        setVolume(kind, v);
        pct.setText(volumeLabel(v));
      },
      // Let the player hear the new effects level.
      kind === 'sfx' ? () => playSfx(this, 'click') : undefined,
    );
    panel.add([makeText(this, -edge, y, label, 14).setOrigin(0, 0.5), slider, pct]);
  }

  /** Pop out and hand control back to the host. */
  private close(): void {
    if (this.closing) return;
    this.closing = true;
    this.input.enabled = false;
    this.host.setOverlayOpen(false);
    this.popOut();
  }

  /** RESTART / QUIT: pop out and switch scenes from the game underneath. */
  private leave(key: 'Game' | 'Menu', data?: object): void {
    if (this.closing) return;
    this.closing = true;
    this.input.enabled = false;
    hideDim();
    this.popOut();
    goTo(this.host, key, data);
  }

  private popOut(): void {
    this.tweens.add({
      targets: this.panel,
      scale: 0.9,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => this.scene.stop(),
    });
  }
}
