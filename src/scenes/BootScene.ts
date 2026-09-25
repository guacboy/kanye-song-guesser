import Phaser from 'phaser';
import { COLORS, RENDER_SCALE } from '../theme';
import { TIERS, Tier } from '../data/songs';
import { loadSfx } from '../sfx';

/** Life icon textures, loaded from assets/lives/<state>-kanye.png. */
export const LIFE_TEXTURES = { alive: 'life-alive', dead: 'life-dead' } as const;
export const playlistTexture = (tier: Tier) => `playlist-${tier}`;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Optional art. Anything missing falls back to a drawn placeholder / plain card.
    for (const [state, key] of Object.entries(LIFE_TEXTURES)) this.load.image(key, `assets/lives/${state}-kanye.png`);
    for (const t of TIERS) this.load.image(playlistTexture(t.id), `assets/playlists/${t.id}.png`);
    loadSfx(this);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.info(`[boot] ${file.src} not found, using fallback`);
    });
  }

  create(): void {
    for (const key of Object.values(LIFE_TEXTURES)) {
      if (!this.textures.exists(key)) this.makePlaceholderLife(key);
    }
    this.scene.start('Menu');
  }

  /** Heart drawn at render scale so it stays sharp; GameScene scales it down. */
  private makePlaceholderLife(key: string): void {
    const s = RENDER_SCALE;
    const g = this.make.graphics({}, false);
    g.fillStyle(COLORS.textNum);
    g.fillCircle(13 * s, 14 * s, 12 * s);
    g.fillCircle(35 * s, 14 * s, 12 * s);
    g.fillTriangle(2 * s, 19 * s, 46 * s, 19 * s, 24 * s, 44 * s);
    g.generateTexture(key, 48 * s, 48 * s);
    g.destroy();
  }
}
