import Phaser from 'phaser';
import { COLORS, HEIGHT, RADIUS, WIDTH, fitCamera, makeText } from '../theme';
import { TIERS, Tier } from '../data/songs';
import { Button } from '../ui/Button';
import { hideDim } from '../ui/backdrop';
import { goTo } from '../transition';
import { playSfx } from '../sfx';

export type EndReason = 'out-of-lives' | 'finished' | 'no-audio';

export interface ResultsData {
  tier: Tier;
  score: number;
  played: number;
  reason: EndReason;
}

const TITLES: Record<EndReason, string> = {
  'out-of-lives': 'GAME OVER',
  finished: 'RESULTS',
  'no-audio': 'NO AUDIO FOUND',
};

const PANEL_W = 380;
const PANEL_H = 340;

/**
 * Results pop-up, launched on top of the (dimmed, inactive) game scene. Its buttons leave through
 * the game scene, so the usual scene transition still plays.
 */
export class ResultsScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private leaving = false;

  constructor() {
    super('Results');
  }

  create({ tier, score, played, reason }: ResultsData): void {
    fitCamera(this);
    this.leaving = false;
    this.input.enabled = true; // leave() turned it off; the plugin keeps that across launches
    if (reason === 'finished') playSfx(this, 'win');
    else if (reason === 'out-of-lives') playSfx(this, 'lose');

    const panel = this.add.container(WIDTH / 2, HEIGHT / 2);
    const box = this.add.graphics();
    box.fillStyle(COLORS.bgNum).fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, RADIUS * 1.5);
    box.lineStyle(2, COLORS.textNum).strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, RADIUS * 1.5);
    panel.add([
      box,
      makeText(this, 0, -128, TITLES[reason], 28).setFontStyle('bold'),
      makeText(this, 0, -98, TIERS.find((t) => t.id === tier)?.label ?? '', 13, COLORS.muted),
    ]);

    if (reason === 'no-audio') {
      panel.add(
        makeText(this, 0, -8, 'None of the songs in this playlist\ncould be loaded. Add audio files\nto public/audio/ - see README.', 14, COLORS.muted)
          .setAlign('center'),
      );
    } else {
      const best = this.updateBest(tier, score);
      panel.add([
        makeText(this, 0, -30, `${score}`, 52).setFontStyle('bold'),
        makeText(this, 0, 12, `song${score === 1 ? '' : 's'} guessed of ${played}`, 14, COLORS.muted),
        makeText(this, 0, 40, `Best: ${best}`, 15),
      ]);
    }

    panel.add([
      new Button(this, 82, 118, 'PLAY AGAIN', () => this.leave('Game', { tier }), 150, 40, 14),
      new Button(this, -82, 118, 'MAIN MENU', () => this.leave('Menu'), 150, 40, 14),
    ]);
    this.panel = panel;

    // Pop in
    panel.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
  }

  /** Pop out, lift the dim, and switch scenes from the game underneath. */
  private leave(key: 'Game' | 'Menu', data?: object): void {
    if (this.leaving) return;
    this.leaving = true;
    this.input.enabled = false;
    hideDim();
    this.tweens.add({
      targets: this.panel,
      scale: 0.9,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => this.scene.stop(),
    });
    goTo(this.scene.get('Game'), key, data);
  }

  private updateBest(tier: Tier, score: number): number {
    const key = `ksg-best-${tier}`;
    try {
      const best = Math.max(Number(localStorage.getItem(key)) || 0, score);
      localStorage.setItem(key, String(best));
      return best;
    } catch {
      return score;
    }
  }
}
