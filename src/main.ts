import './style.css'
import { h, render } from 'preact'

import { Game } from './core/game'
import GameOptions from './core/game-options'
import { Hud } from './ui/hud'

const canvas = document.getElementById('application-canvas') as HTMLCanvasElement
const options = await GameOptions.create(canvas)
const game = new Game(canvas, options)

const uiRoot = document.getElementById('ui-root')
if (uiRoot) {
    render(h(Hud, { app: game }), uiRoot)
}

export { game }
