import Phaser from 'phaser';
import { COLORS, RENDER_SCALE } from '../theme';
import { TIERS, Tier } from '../data/songs';

export const LIFE_TEXTURE = 'life';
export const playlistTexture = (tier: Tier) => `playlist-${tier}`;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Optional art. Anything missing falls back to a drawn placeholder / plain card.
    this.load.image(LIFE_TEXTURE, 'assets/life.png');
    for (const t of TIERS) this.load.image(playlistTexture(t.id), `assets/playlists/${t.id}.png`);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.info(`[boot] ${file.src} not found, using fallback`);
    });
  }

  create(): void {
    if (!this.textures.exists(LIFE_TEXTURE)) this.makePlaceholderLife();
    this.scene.start('Menu');
  }

  /** Heart drawn at render scale so it stays sharp; GameScene scales it to 48 layout px. */
  private makePlaceholderLife(): void {
    const s = RENDER_SCALE;
    const g = this.make.graphics({}, false);
    g.fillStyle(COLORS.textNum);
    g.fillCircle(13 * s, 14 * s, 12 * s);
    g.fillCircle(35 * s, 14 * s, 12 * s);
    g.fillTriangle(2 * s, 19 * s, 46 * s, 19 * s, 24 * s, 44 * s);
    g.generateTexture(LIFE_TEXTURE, 48 * s, 48 * s);
    g.destroy();
  }
}
