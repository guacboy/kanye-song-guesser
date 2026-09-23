import Phaser from 'phaser';
import type { Song } from '../data/types';
import { formatCredits, searchSongs } from '../logic/search';

/**
 * Text box + submit arrow + autocomplete dropdown, rendered as a Phaser DOM element
 * (a canvas can't host a real text input).
 */
export class GuessInput {
  readonly element: Phaser.GameObjects.DOMElement;
  private input: HTMLInputElement;
  private submitBtn: HTMLButtonElement;
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
      <div class="guess-row">
        <input class="guess-input" type="text" placeholder="Know it? Search for the title"
          autocomplete="off" spellcheck="false" />
        <button class="btn" type="button" aria-label="Submit guess" disabled>&rarr;</button>
      </div>
      <ul class="suggestions"></ul>`;
    this.input = root.querySelector('input')!;
    this.submitBtn = root.querySelector('button')!;
    this.list = root.querySelector('ul')!;

    this.input.addEventListener('input', () => this.update());
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.input.addEventListener('blur', () => this.close());
    this.submitBtn.addEventListener('click', () => this.submit());
    // mousedown (not click) so it fires before the input's blur closes the list.
    this.list.addEventListener('mousedown', (e) => {
      const li = (e.target as HTMLElement).closest('li');
      if (!li) return;
      e.preventDefault();
      this.choose(Number(li.dataset.index));
    });

    this.element = scene.add.dom(x, y, root);
  }

  setEnabled(enabled: boolean): void {
    this.input.disabled = !enabled;
    if (!enabled) this.close();
    this.refreshSubmit();
  }

  clear(): void {
    this.input.value = '';
    this.close();
    this.refreshSubmit();
  }

  focus(): void {
    this.input.focus();
  }

  private update(): void {
    this.refreshSubmit();
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
    this.refreshSubmit();
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

  private refreshSubmit(): void {
    this.submitBtn.disabled = this.input.disabled || this.input.value.trim() === '';
  }
}
