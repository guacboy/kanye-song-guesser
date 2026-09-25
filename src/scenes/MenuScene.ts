import Phaser from 'phaser';
import { COLORS, WIDTH, fitCamera, makeText } from '../theme';
import { TIERS, Tier, songsForTier } from '../data/songs';
import { Button } from '../ui/Button';
import { PlaylistCard } from '../ui/PlaylistCard';
import { playSfx } from '../sfx';
import { enterScene, goTo } from '../transition';
import { playlistTexture } from './BootScene';

const LAST_TIER_KEY = 'ksg-last-tier';

const CARD_SIZE = 130;
const CARD_GAP = 20;
const CARD_Y = 290;

export class MenuScene extends Phaser.Scene {
  private selected: Tier = '1b';
  private cards = new Map<Tier, PlaylistCard>();

  constructor() {
    super('Menu');
  }

  create(): void {
    fitCamera(this);
    const cx = WIDTH / 2;

    const kanye = makeText(this, 32, 40, 'Kanye', 32).setOrigin(0, 0.5).setFontStyle('bold');
    makeText(this, kanye.x + kanye.width, 40, 'Guess', 32, COLORS.accent).setOrigin(0, 0.5).setFontStyle('bold');

    makeText(this, cx, CARD_Y - CARD_SIZE / 2 - 36, 'CHOOSE A PLAYLIST', 14, COLORS.muted).setLetterSpacing(3);

    this.cards.clear();
    const rowWidth = TIERS.length * CARD_SIZE + (TIERS.length - 1) * CARD_GAP;
    TIERS.forEach((t, i) => {
      const x = cx - rowWidth / 2 + CARD_SIZE / 2 + i * (CARD_SIZE + CARD_GAP);
      const count = songsForTier(t.id).length;
      const card = new PlaylistCard(
        this, x, CARD_Y, CARD_SIZE,
        `${count} song${count === 1 ? '' : 's'}`, t.label,
        playlistTexture(t.id),
        () => this.select(t.id),
      );
      this.cards.set(t.id, card);
    });

    // Own sound instead of the regular click; hover uses the "Guess" green.
    new Button(this, cx, 430, 'START', () => this.startGame(), 150, 42, 16, false, false).setHoverColor(COLORS.accentNum);

    this.select(this.loadLastTier());
    enterScene(this);
  }

  private select(tier: Tier): void {
    this.selected = tier;
    this.cards.forEach((card, id) => card.setSelected(id === tier));
  }

  private startGame(): void {
    playSfx(this, 'start');
    try {
      localStorage.setItem(LAST_TIER_KEY, this.selected);
    } catch {
      // storage unavailable (private mode / sandboxed iframe) - not important
    }
    goTo(this, 'Game', { tier: this.selected });
  }

  private loadLastTier(): Tier {
    try {
      const saved = localStorage.getItem(LAST_TIER_KEY);
      if (saved && TIERS.some((t) => t.id === saved)) return saved as Tier;
    } catch {
      // ignore
    }
    return '1b';
  }
}
