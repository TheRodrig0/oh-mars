import { AppBase } from 'playcanvas';
import type GameOptions from './game-options';

export class Game extends AppBase {
    public readonly gameOptions: GameOptions;

    constructor(canvas: HTMLCanvasElement, options: GameOptions) {
        super(canvas);

        this.gameOptions = options;

        this.init(options);
        this.start();

        window.addEventListener('resize', this.handleResize);
    }

    private handleResize = (): void => {
        this.resizeCanvas();
    };

    public override destroy(): void {
        window.removeEventListener('resize', this.handleResize);
        super.destroy();
    }
}
