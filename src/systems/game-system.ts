import type { AppBase } from "playcanvas"

export abstract class GameSystem {
  protected app: AppBase

  constructor(app: AppBase) {
    this.app = app

    this.app.on('update', this.update, this)
  }

  public abstract initialize(): void

  public update(_delta: number): void { }

  public dispose(): void {
    this.app.off('update', this.update, this)
  }
}
