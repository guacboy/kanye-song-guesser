import Phaser from 'phaser';
import { COLORS, WIDTH, fitCamera, makeText } from '../theme';
import { TIERS, Tier } from '../data/songs';
import { Button } from '../ui/Button';

export type EndReason = 'out-of-lives' | 'finished' | 'no-audio';

interface GameOverData {
  tier: Tier;
  score: number;
  played: number;
  reason: EndReason;
}

const TITLES: Record<EndReason, string> = {
  'out-of-lives': 'GAME OVER',
  finished: 'PLAYLIST COMPLETE',
  'no-audio': 'NO AUDIO FOUND',
};

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ tier, score, played, reason }: GameOverData): void {
    fitCamera(this);
    const cx = WIDTH / 2;
    const tierLabel = TIERS.find((t) => t.id === tier)?.label ?? '';

    makeText(this, cx, 130, TITLES[reason], 44).setFontStyle('bold');
    makeText(this, cx, 180, tierLabel, 16, COLORS.muted);

    if (reason === 'no-audio') {
      makeText(this, cx, 260, 'None of the songs in this playlist could be loaded.\nAdd audio files to public/audio/ — see README.', 16, COLORS.muted).setAlign('center');
    } else {
      const best = this.updateBest(tier, score);
      makeText(this, cx, 250, `${score}`, 72).setFontStyle('bold');
      makeText(this, cx, 305, `song${score === 1 ? '' : 's'} guessed of ${played}`, 18, COLORS.muted);
      makeText(this, cx, 345, `Best: ${best}`, 18);
    }

    new Button(this, cx, 430, 'PLAY AGAIN', () => this.scene.start('Game', { tier }), 280, 52);
    new Button(this, cx, 495, 'MAIN MENU', () => this.scene.start('Menu'), 280, 52);
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
