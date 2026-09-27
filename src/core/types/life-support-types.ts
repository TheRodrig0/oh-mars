export type DeathCause = 'asphyxiation' | 'dehydration' | 'starvation' | null

export type VitalsData = {
    health: number
    oxygen: number
    water: number
    food: number
    isSuffocating: boolean
    isCriticalOxygen: boolean
    isRecovering: boolean
    isGameOver: boolean
    deathCause: DeathCause
}

export type VitalRates = {
    oxygenBaseRate: number
    oxygenWalkMultiplier: number
    oxygenRunMultiplier: number
    waterRatePerHour: number
    foodRatePerHour: number
    suffocationDamageRate: number
    dehydrationDamageRate: number
    starvationDamageRate: number
    healthRecoveryRate: number
}
