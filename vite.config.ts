import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const AUDIO_DIR = fileURLToPath(new URL('./public/audio', import.meta.url));
const AUDIO_EXT = /\.(mp3|ogg|m4a|wav)$/i;

function listAudioFiles(): string[] {
  try {
    return readdirSync(AUDIO_DIR).filter((f) => AUDIO_EXT.test(f)).sort();
  } catch {
    return [];
  }
}

/** Restart the dev server when audio files are added/removed so __AUDIO_FILES__ stays current. */
function watchAudioDir(): Plugin {
  return {
    name: 'watch-audio-dir',
    configureServer(server) {
      server.watcher.add(AUDIO_DIR);
      const onChange = (path: string) => {
        if (resolve(path).startsWith(AUDIO_DIR) && AUDIO_EXT.test(path)) void server.restart();
      };
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

export default defineConfig({
  // Relative asset paths so the build works inside itch.io's iframe/CDN subfolder.
  base: './',
  define: {
    __AUDIO_FILES__: JSON.stringify(listAudioFiles()),
  },
  plugins: [watchAudioDir()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    // Phaser alone is ~1.2 MB minified.
    chunkSizeWarningLimit: 1600,
  },
});
