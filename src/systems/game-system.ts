import type { Game } from '../core/game'

export abstract class GameSystem {
    protected app: Game

    constructor(app: Game) {
        this.app = app

        this.app.on('update', this.update, this)
    }

    public abstract initialize(): void

    public update(_delta: number): void {
        // Optional subclass update lifecycle hook
    }

    public dispose(): void {
        this.app.off('update', this.update, this)
    }
}
