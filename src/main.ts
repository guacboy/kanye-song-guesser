import Phaser from 'phaser';
import { HEIGHT, RENDER_SCALE, WIDTH } from './theme';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { ResultsScene } from './scenes/ResultsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { applyBaseBackdrop } from './ui/backdrop';

applyBaseBackdrop();

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
  // Overlay scenes (Results, Settings) come last so they render on top.
  scene: [BootScene, MenuScene, GameScene, ResultsScene, SettingsScene],
});
