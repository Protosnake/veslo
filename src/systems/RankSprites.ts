import spriteMarkup from '../assets/ranks.svg?raw';

const SPRITE_HOST_ID = 'rank-insignia-sprite';

/** Injects the shared rank insignia <symbol> sheet once per page. */
export function mountRankSprites() {
  if (document.getElementById(SPRITE_HOST_ID)) return;

  const host = document.createElement('div');
  host.id = SPRITE_HOST_ID;
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  host.innerHTML = spriteMarkup;
  document.body.appendChild(host);
}

/** Returns an <svg> that references a rank symbol from the sprite sheet. */
export function rankIconMarkup(rank: { sprite: string }, className = 'rank-insignia'): string {
  return `<svg class="${className}" viewBox="0 0 44 62" aria-hidden="true" focusable="false"><use href="#${rank.sprite}"/></svg>`;
}
