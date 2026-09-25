import Phaser from 'phaser';
import { COLORS, HEIGHT, RADIUS, WIDTH, fitCamera, makeText } from '../theme';
import { TIERS, Tier } from '../data/songs';
import { Button } from '../ui/Button';
import { hideDim } from '../ui/backdrop';
import { goTo } from '../transition';
import { playSfx } from '../sfx';
import { breakdownLines } from '../logic/score';

export type EndReason = 'out-of-lives' | 'finished' | 'no-audio';

export interface ResultsData {
  tier: Tier;
  score: number;
  /** hits[i] = songs guessed on clip i. */
  hits: number[];
  reason: EndReason;
}

const TITLES: Record<EndReason, string> = {
  'out-of-lives': 'GAME OVER',
  finished: 'RESULTS',
  'no-audio': 'NO AUDIO FOUND',
};

const PANEL_W = 380;
const PANEL_H = 420;
const TOP = -PANEL_H / 2;
const LINE_GAP = 22; // between breakdown lines

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

  create({ tier, score, hits, reason }: ResultsData): void {
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
      makeText(this, 0, TOP + 42, TITLES[reason], 28).setFontStyle('bold'),
      makeText(this, 0, TOP + 72, TIERS.find((t) => t.id === tier)?.label ?? '', 13, COLORS.muted),
    ]);

    if (reason === 'no-audio') {
      panel.add(
        makeText(this, 0, -8, 'None of the songs in this playlist\ncould be loaded. Add audio files\nto public/audio/ - see README.', 14, COLORS.muted)
          .setAlign('center'),
      );
    } else {
      const best = this.updateBest(tier, score);
      const lines = breakdownLines(hits);
      const linesY = TOP + 174;
      panel.add([
        makeText(this, 0, TOP + 122, `${score}`, 52).setFontStyle('bold'),
        ...lines.map((line, i) => makeText(this, 0, linesY + i * LINE_GAP, line, 14, COLORS.muted)),
        makeText(this, 0, linesY + lines.length * LINE_GAP + 16, `Best: ${best}`, 15),
      ]);
    }

    panel.add([
      new Button(this, 82, PANEL_H / 2 - 46, 'PLAY AGAIN', () => this.leave('Game', { tier }), 150, 40, 14),
      new Button(this, -82, PANEL_H / 2 - 46, 'MAIN MENU', () => this.leave('Menu'), 150, 40, 14),
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
    const key = `ksg-best-score-${tier}`; // points; the old ksg-best-<tier> counted songs
    try {
      const best = Math.max(Number(localStorage.getItem(key)) || 0, score);
      localStorage.setItem(key, String(best));
      return best;
    } catch {
      return score;
    }
  }
}
