import Phaser from 'phaser';
import { HEIGHT, RENDER_SCALE, WIDTH } from './theme';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH * RENDER_SCALE,
  height: HEIGHT * RENDER_SCALE,
  // Transparent canvas so the CSS gradient on <body> shows through.
  transparent: true,
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
});
