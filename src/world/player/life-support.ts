import { LifeSupportEvent } from '../../core/enums/life-support-enums'
import { PlayerEvent } from '../../core/enums/player-enums'
import type { Game } from '../../core/game'
import type { DeathCause, VitalRates, VitalsData } from '../../core/types/life-support-types'
import type { PlayerStateData } from '../../core/types/player-types'

export class PlayerLifeSupport {
    private app: Game

    public health = 100
    public oxygen = 100
    public water = 100
    public food = 100

    public isSuffocating = false
    public isCriticalOxygen = false
    public isRecovering = false
    public isGameOver = false
    public deathCause: DeathCause = null

    private isMoving = false
    private isRunning = false
    private criticalOxygenThreshold = 25
    private safeVitalsThreshold = 20

    public rates: VitalRates

    constructor(app: Game) {
        this.app = app

        const opts = app.gameOptions.lifeSupport
        this.health = opts.initialHealth
        this.oxygen = opts.initialOxygen
        this.water = opts.initialWater
        this.food = opts.initialFood
        this.criticalOxygenThreshold = opts.criticalOxygenThreshold
        this.safeVitalsThreshold = opts.safeVitalsThreshold
        this.rates = {
            oxygenBaseRate: opts.oxygenBaseRate,
            oxygenWalkMultiplier: opts.oxygenWalkMultiplier,
            oxygenRunMultiplier: opts.oxygenRunMultiplier,
            waterRatePerHour: opts.waterRatePerHour,
            foodRatePerHour: opts.foodRatePerHour,
            suffocationDamageRate: opts.suffocationDamageRate,
            dehydrationDamageRate: opts.dehydrationDamageRate,
            starvationDamageRate: opts.starvationDamageRate,
            healthRecoveryRate: opts.healthRecoveryRate
        }

        this.onPlayerStateChanged = this.onPlayerStateChanged.bind(this)
        this.onKeyDown = this.onKeyDown.bind(this)
        this.refillOxygen = this.refillOxygen.bind(this)
        this.drinkWater = this.drinkWater.bind(this)
        this.eatFood = this.eatFood.bind(this)
        this.respawn = this.respawn.bind(this)
        this.emitVitalsChanged = this.emitVitalsChanged.bind(this)
        this.update = this.update.bind(this)

        this.app.on(PlayerEvent.STATE_CHANGED, this.onPlayerStateChanged, this)
        this.app.on(LifeSupportEvent.REFILL_OXYGEN, this.refillOxygen, this)
        this.app.on(LifeSupportEvent.DRINK_WATER, this.drinkWater, this)
        this.app.on(LifeSupportEvent.EAT_FOOD, this.eatFood, this)
        this.app.on(LifeSupportEvent.RESPAWN, this.respawn, this)
        this.app.on(LifeSupportEvent.REQUEST_VITALS, this.emitVitalsChanged, this)
        this.app.on('update', this.update, this)

        window.addEventListener('keydown', this.onKeyDown)

        this.emitVitalsChanged()
    }

    public dispose(): void {
        this.app.off(PlayerEvent.STATE_CHANGED, this.onPlayerStateChanged, this)
        this.app.off(LifeSupportEvent.REFILL_OXYGEN, this.refillOxygen, this)
        this.app.off(LifeSupportEvent.DRINK_WATER, this.drinkWater, this)
        this.app.off(LifeSupportEvent.EAT_FOOD, this.eatFood, this)
        this.app.off(LifeSupportEvent.RESPAWN, this.respawn, this)
        this.app.off(LifeSupportEvent.REQUEST_VITALS, this.emitVitalsChanged, this)
        this.app.off('update', this.update, this)

        window.removeEventListener('keydown', this.onKeyDown)
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (this.isGameOver) {
            const isRespawnKey = e.code === 'KeyR'
            if (isRespawnKey) {
                this.app.fire(LifeSupportEvent.RESPAWN)
            }
            return
        }

        const isRefillOxygenKey = e.code === 'KeyO'
        if (isRefillOxygenKey) {
            this.refillOxygen()
            return
        }

        const isDrinkWaterKey = e.code === 'KeyH'
        if (isDrinkWaterKey) {
            this.drinkWater()
            return
        }

        const isEatFoodKey = e.code === 'KeyJ'
        if (isEatFoodKey) {
            this.eatFood()
            return
        }
    }

    private onPlayerStateChanged(state: PlayerStateData): void {
        this.isMoving = state.isMoving
        this.isRunning = state.isRunning
    }

    public refillOxygen(): void {
        if (this.isGameOver) {
            return
        }

        this.oxygen = 100
        const wasSuffocating = this.isSuffocating
        if (wasSuffocating) {
            this.isSuffocating = false
            this.app.fire(LifeSupportEvent.SUFFOCATION_STOP)
        }

        this.isCriticalOxygen = false
        this.emitVitalsChanged()
    }

    public drinkWater(): void {
        if (this.isGameOver) {
            return
        }

        this.water = 100
        this.emitVitalsChanged()
    }

    public eatFood(): void {
        if (this.isGameOver) {
            return
        }

        this.food = 100
        this.emitVitalsChanged()
    }

    public respawn(): void {
        const opts = this.app.gameOptions.lifeSupport
        this.health = opts.initialHealth
        this.oxygen = opts.initialOxygen
        this.water = opts.initialWater
        this.food = opts.initialFood
        this.isSuffocating = false
        this.isCriticalOxygen = false
        this.isGameOver = false
        this.deathCause = null
        this.isRecovering = false

        this.app.fire(LifeSupportEvent.SUFFOCATION_STOP)
        this.emitVitalsChanged()
    }

    public update(dt: number): void {
        if (this.isGameOver) {
            return
        }

        const delta = Math.min(Math.max(0, dt), 0.1)

        let o2Multiplier = 1.0
        if (this.isMoving) {
            o2Multiplier = this.rates.oxygenWalkMultiplier
        }

        if (this.isRunning) {
            o2Multiplier = this.rates.oxygenRunMultiplier
        }

        const oxygenLoss = this.rates.oxygenBaseRate * o2Multiplier * delta
        this.oxygen = Math.max(0, this.oxygen - oxygenLoss)

        const wasCritical = this.isCriticalOxygen
        this.isCriticalOxygen = this.oxygen > 0 && this.oxygen < this.criticalOxygenThreshold
        const enteredCritical = !wasCritical && this.isCriticalOxygen
        if (enteredCritical && !this.isSuffocating) {
            this.app.fire(LifeSupportEvent.WARNING_TRIGGERED)
        }

        const wasSuffocating = this.isSuffocating
        this.isSuffocating = this.oxygen <= 0
        const startedSuffocating = !wasSuffocating && this.isSuffocating
        if (startedSuffocating) {
            this.app.fire(LifeSupportEvent.WARNING_TRIGGERED)
            this.app.fire(LifeSupportEvent.SUFFOCATION_START)
        }

        const stoppedSuffocating = wasSuffocating && !this.isSuffocating
        if (stoppedSuffocating) {
            this.app.fire(LifeSupportEvent.SUFFOCATION_STOP)
        }

        this.water = Math.max(0, this.water - this.rates.waterRatePerHour * delta)
        this.food = Math.max(0, this.food - this.rates.foodRatePerHour * delta)

        let damage = 0
        let currentCause: DeathCause = null

        if (this.isSuffocating) {
            damage += this.rates.suffocationDamageRate * delta
            currentCause = 'asphyxiation'
        }

        const isDehydrated = this.water <= 0
        if (isDehydrated) {
            damage += this.rates.dehydrationDamageRate * delta
            const hasNoCauseYet = !currentCause
            if (hasNoCauseYet) {
                currentCause = 'dehydration'
            }
        }

        const isStarving = this.food <= 0
        if (isStarving) {
            damage += this.rates.starvationDamageRate * delta
            const hasNoCauseYet = !currentCause
            if (hasNoCauseYet) {
                currentCause = 'starvation'
            }
        }

        this.isRecovering = false
        const hasDamage = damage > 0
        if (hasDamage) {
            this.health = Math.max(0, this.health - damage)
            this.deathCause = currentCause
        }

        const hasFullSupplies =
            this.oxygen > this.safeVitalsThreshold &&
            this.water > this.safeVitalsThreshold &&
            this.food > this.safeVitalsThreshold
        const isDamaged = this.health < 100
        const canHeal = damage === 0 && hasFullSupplies && isDamaged
        if (canHeal) {
            this.health = Math.min(100, this.health + this.rates.healthRecoveryRate * delta)
            this.isRecovering = true
            this.deathCause = null
        }

        const isPlayerDead = this.health <= 0
        if (isPlayerDead) {
            this.health = 0
            this.isGameOver = true
            this.app.fire(LifeSupportEvent.GAME_OVER, { cause: this.deathCause })
        }

        this.emitVitalsChanged()
    }

    public getVitalsData(): VitalsData {
        return {
            health: this.health,
            oxygen: this.oxygen,
            water: this.water,
            food: this.food,
            isSuffocating: this.isSuffocating,
            isCriticalOxygen: this.isCriticalOxygen,
            isRecovering: this.isRecovering,
            isGameOver: this.isGameOver,
            deathCause: this.deathCause
        }
    }

    private emitVitalsChanged(): void {
        this.app.fire(LifeSupportEvent.VITALS_CHANGED, this.getVitalsData())
    }
}
