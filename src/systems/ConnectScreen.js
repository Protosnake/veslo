export class ConnectScreen {
  constructor(root) {
    this.root = root;
    this.active = false;
    this.time = 0;
  }

  show() {
    if (!this.root) return;
    this.root.classList.add('is-active');
    this.root.classList.remove('is-black');
    this.active = true;
    this.time = 0;
  }

  hide() {
    if (!this.root) return;
    this.root.classList.remove('is-active', 'is-black');
    this.active = false;
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;

    if (this.time > 1.8) {
      const blink = Math.floor((this.time - 1.8) / 0.09) % 2 === 1;
      this.root.classList.toggle('is-black', blink);
    }
  }
}
