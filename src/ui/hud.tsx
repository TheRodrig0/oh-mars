import { useEffect, useState } from 'preact/hooks'

import { LifeSupportEvent } from '../core/enums/life-support-enums'
import type { Game } from '../core/game'
import type { VitalsData } from '../core/types/life-support-types'

type HudProps = {
    app: Game
}

const initialVitals: VitalsData = {
    health: 100,
    oxygen: 100,
    water: 100,
    food: 100,
    isSuffocating: false,
    isCriticalOxygen: false,
    isRecovering: false,
    isGameOver: false,
    deathCause: null
}

export function Hud({ app }: HudProps) {
    const [vitals, setVitals] = useState<VitalsData>(initialVitals)
    const lowThreshold = app.gameOptions.lifeSupport.criticalOxygenThreshold

    useEffect(() => {
        const handleVitals = (data: VitalsData) => setVitals(data)
        app.on(LifeSupportEvent.VITALS_CHANGED, handleVitals)
        app.fire(LifeSupportEvent.REQUEST_VITALS)

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'KeyR' && vitals.isGameOver) {
                app.fire(LifeSupportEvent.RESPAWN)
            }
        }
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            app.off(LifeSupportEvent.VITALS_CHANGED, handleVitals)
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [app, vitals.isGameOver])

    const handleRespawn = () => {
        app.fire(LifeSupportEvent.RESPAWN)
    }

    // Dynamic suffocation pulse calculations:
    // Darkness pulses in and out, escalating as health decreases
    const suffocationFactor = vitals.isSuffocating ? Math.max(0, (100 - vitals.health) / 100) : 0
    const minOpacity = (0.15 + suffocationFactor * 0.7).toFixed(2)
    const maxOpacity = (0.55 + suffocationFactor * 0.45).toFixed(2)
    const baseBlur = (4 + suffocationFactor * 14).toFixed(1)

    // Checks for low status
    const healthLow = vitals.health < lowThreshold
    const oxygenLow = vitals.oxygen < lowThreshold
    const waterLow = vitals.water < lowThreshold
    const foodLow = vitals.food < lowThreshold

    return (
        <div class="hud-container">
            {/* Suffocation Pulsing Vision Loss: escurece, volta, escurece mais, até ficar preto */}
            {vitals.isSuffocating && !vitals.isGameOver && (
                <div
                    class="suffocation-overlay suffocation-pulse"
                    style={
                        {
                            '--suffocation-min-opacity': minOpacity,
                            '--suffocation-max-opacity': maxOpacity,
                            '--suffocation-blur': `${baseBlur}px`
                        } as Record<string, string>
                    }
                >
                    <div class="suffocation-blackout-layer" />
                    <div class="suffocation-vignette" />
                </div>
            )}

            {/* Clean Minimalist HUD com indicador de status baixo piscando em vermelho */}
            {!vitals.isGameOver && (
                <div class="hud-minimal">
                    <div class={`vital-row ${healthLow ? 'low-warning' : ''}`}>
                        <span class="vital-emoji">❤️</span>
                        <div class="vital-track">
                            <div class="vital-fill" style={{ width: `${vitals.health}%` }} />
                        </div>
                        <span class="vital-pct">{Math.round(vitals.health)}%</span>
                    </div>

                    <div class={`vital-row ${oxygenLow ? 'low-warning' : ''}`}>
                        <span class="vital-emoji">💨</span>
                        <div class="vital-track">
                            <div class="vital-fill" style={{ width: `${vitals.oxygen}%` }} />
                        </div>
                        <span class="vital-pct">{Math.round(vitals.oxygen)}%</span>
                    </div>

                    <div class={`vital-row ${waterLow ? 'low-warning' : ''}`}>
                        <span class="vital-emoji">💧</span>
                        <div class="vital-track">
                            <div class="vital-fill" style={{ width: `${vitals.water}%` }} />
                        </div>
                        <span class="vital-pct">{Math.round(vitals.water)}%</span>
                    </div>

                    <div class={`vital-row ${foodLow ? 'low-warning' : ''}`}>
                        <span class="vital-emoji">🍖</span>
                        <div class="vital-track">
                            <div class="vital-fill" style={{ width: `${vitals.food}%` }} />
                        </div>
                        <span class="vital-pct">{Math.round(vitals.food)}%</span>
                    </div>
                </div>
            )}

            {/* Tela de Morte Limpa */}
            {vitals.isGameOver && (
                <div class="death-screen" onClick={handleRespawn}>
                    <div class="death-title">Você morreu</div>
                    <div class="death-action">[R] para reiniciar</div>
                </div>
            )}
        </div>
    )
}
