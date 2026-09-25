import Phaser from 'phaser';
import type { Song } from '../data/types';
import { formatCredits, searchSongs } from '../logic/search';

/**
 * Text box + autocomplete dropdown, rendered as a Phaser DOM element (a canvas can't host a real
 * text input). Enter submits.
 */
export class GuessInput {
  readonly element: Phaser.GameObjects.DOMElement;
  private input: HTMLInputElement;
  private list: HTMLUListElement;
  private matches: Song[] = [];
  private active = -1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private songs: Song[],
    private onSubmit: (guess: string) => void,
  ) {
    const root = document.createElement('div');
    root.className = 'guess';
    root.innerHTML = `
      <input class="guess-input" type="text" placeholder="Type your answer here.."
        autocomplete="off" spellcheck="false" />
      <ul class="suggestions"></ul>`;
    this.input = root.querySelector('input')!;
    this.list = root.querySelector('ul')!;

    this.input.addEventListener('input', () => this.update());
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.input.addEventListener('blur', () => this.close());
    // mousedown (not click) so it fires before the input's blur closes the list.
    this.list.addEventListener('mousedown', (e) => {
      const li = (e.target as HTMLElement).closest('li');
      if (!li) return;
      e.preventDefault();
      this.choose(Number(li.dataset.index));
    });
    // Keep presses on the dropdown from reaching the game canvas/window listeners underneath.
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click']) {
      this.list.addEventListener(type, (e) => e.stopPropagation());
    }

    this.element = scene.add.dom(x, y, root);
  }

  setEnabled(enabled: boolean): void {
    this.input.disabled = !enabled;
    if (!enabled) this.close();
  }

  clear(): void {
    this.input.value = '';
    this.close();
  }

  focus(): void {
    this.input.focus();
  }

  private update(): void {
    this.matches = searchSongs(this.songs, this.input.value);
    if (this.matches.length === 0) return this.close();
    this.active = -1;
    this.render();
  }

  private render(): void {
    this.list.replaceChildren(
      ...this.matches.map((song, i) => {
        const li = document.createElement('li');
        const title = document.createElement('div');
        title.className = 'suggestion-title';
        title.textContent = song.title;
        const credits = document.createElement('div');
        credits.className = 'suggestion-credits';
        credits.textContent = formatCredits(song);
        li.append(title, credits);
        li.dataset.index = String(i);
        if (i === this.active) li.className = 'active';
        return li;
      }),
    );
    this.list.querySelector('li.active')?.scrollIntoView({ block: 'nearest' });
  }

  private onKey(e: KeyboardEvent): void {
    const open = this.matches.length > 0;
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault();
      this.active = (this.active + 1) % this.matches.length;
      this.render();
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      this.active = (this.active - 1 + this.matches.length) % this.matches.length;
      this.render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && this.active >= 0) this.choose(this.active);
      else this.submit();
    } else if (e.key === 'Escape') {
      this.close();
    }
  }

  private choose(index: number): void {
    this.input.value = this.matches[index].title;
    this.close();
    this.input.focus();
  }

  private submit(): void {
    const guess = this.input.value.trim();
    if (!guess || this.input.disabled) return;
    this.clear();
    this.onSubmit(guess);
  }

  private close(): void {
    this.matches = [];
    this.active = -1;
    this.list.replaceChildren();
  }
}
