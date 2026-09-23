import type { PlayerAnimationState } from '../enums/player-enums'

export type PlayerAnimation = typeof PlayerAnimationState[keyof typeof PlayerAnimationState]

export interface PlayerStateData {
    isMoving: boolean
    isRunning: boolean
    isGrounded: boolean
    speed: number
}
