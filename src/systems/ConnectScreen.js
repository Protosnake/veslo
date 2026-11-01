export class ConnectScreen {
  constructor(root) {
    this.root = root;
    this.active = false;
    this.time = 0;
  }

  show() {
    if (!this.root) return;
    this.root.classList.add('is-active');
    this.root.classList.remove('is-dim');
    this.active = true;
    this.time = 0;
  }

  hide() {
    if (!this.root) return;
    this.root.classList.remove('is-active', 'is-dim');
    this.active = false;
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;

    const flick =
      (this.time >= 0.55 && this.time < 0.66) ||
      (this.time >= 1.05 && this.time < 1.16);
    this.root.classList.toggle('is-dim', flick);
  }
}
