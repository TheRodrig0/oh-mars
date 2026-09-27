import type { PlayerAnimationState } from '../enums/player-enums'

export type PlayerAnimation = (typeof PlayerAnimationState)[keyof typeof PlayerAnimationState]

export type PlayerStateData = {
    isMoving: boolean
    isRunning: boolean
    isGrounded: boolean
    speed: number
}
