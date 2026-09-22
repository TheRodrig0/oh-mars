import './style.css';
import GameOptions from './core/game-options';
import { Game } from './core/game';

const canvas = document.getElementById('application-canvas') as HTMLCanvasElement;
const options = await GameOptions.create(canvas);
const game = new Game(canvas, options);

export { game };