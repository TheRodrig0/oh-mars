import type { AppBase } from 'playcanvas'
import { Vec3 } from 'playcanvas'
import { GameSystem } from './game-system'
import type Player from '../world/player'
import type Camera from '../core/camera'

export default class MovementSystem extends GameSystem {
    private player: Player
    private camera: Camera

    private speedWalk = 3.2
    private speedRun = 7.0
    private turnSpeed = 15.0

    private gravity = 18.0
    private jumpForce = 6.8
    private verticalVelocity = 0
    private isGrounded = true

    private activeKeys = new Set<string>()
    private moveDir = new Vec3()
    private currentYaw = 0

    constructor(app: AppBase, player: Player, camera: Camera) {
        super(app)
        this.player = player
        this.camera = camera

        this.onKeyDown = this.onKeyDown.bind(this)
        this.onKeyUp = this.onKeyUp.bind(this)
        this.onBlur = this.onBlur.bind(this)
    }

    public initialize(): void {
        window.addEventListener('keydown', this.onKeyDown)
        window.addEventListener('keyup', this.onKeyUp)
        window.addEventListener('blur', this.onBlur)
    }

    public override dispose(): void {
        window.removeEventListener('keydown', this.onKeyDown)
        window.removeEventListener('keyup', this.onKeyUp)
        window.removeEventListener('blur', this.onBlur)
        super.dispose()
    }

    private onBlur(): void {
        this.activeKeys.clear()
    }

    private onKeyDown(e: KeyboardEvent): void {
        this.activeKeys.add(e.code)
        if (e.code === 'Space' && this.isGrounded) {
            this.isGrounded = false
            this.verticalVelocity = this.jumpForce
            this.player.playAnimation('Jump')
        }
    }

    private onKeyUp(e: KeyboardEvent): void {
        this.activeKeys.delete(e.code)
    }

    public override update(dt: number): void {
        const moveForward = this.activeKeys.has('KeyW') || this.activeKeys.has('KeyZ')
        const moveBackward = this.activeKeys.has('KeyS')
        const moveLeft = this.activeKeys.has('KeyA') || this.activeKeys.has('KeyQ')
        const moveRight = this.activeKeys.has('KeyD')
        const isRunning = (this.activeKeys.has('ShiftLeft') || this.activeKeys.has('ShiftRight')) && (moveForward || moveBackward || moveLeft || moveRight)

        const forwardInput = (moveForward ? 1 : 0) - (moveBackward ? 1 : 0)
        const sideInput = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0)
        const isMoving = forwardInput !== 0 || sideInput !== 0

        const currentPos = this.player.getPosition()
        let newY = currentPos.y

        if (!this.isGrounded) {
            this.verticalVelocity -= this.gravity * dt
            newY += this.verticalVelocity * dt

            if (newY <= 0) {
                newY = 0
                this.verticalVelocity = 0
                this.isGrounded = true
            }
        }

        if (!this.isGrounded) {
            this.player.playAnimation('Jump')
        } else if (isMoving) {
            this.player.playAnimation(isRunning ? 'Run' : 'Walk')
        } else {
            this.player.playAnimation('Idle')
        }

        let displacementX = 0
        let displacementZ = 0

        if (isMoving) {
            const currentSpeed = isRunning ? this.speedRun : this.speedWalk
            const camForward = this.camera.forwardHorizontal
            const camRight = this.camera.rightHorizontal

            this.moveDir.set(
                camForward.x * forwardInput + camRight.x * sideInput,
                0,
                camForward.z * forwardInput + camRight.z * sideInput
            )

            if (this.moveDir.lengthSq() > 0.0001) {
                this.moveDir.normalize()

                const targetYaw = Math.atan2(-this.moveDir.x, -this.moveDir.z) * (180 / Math.PI)
                const deltaYaw = ((targetYaw - this.currentYaw + 540) % 360) - 180
                this.currentYaw += deltaYaw * Math.min(1, dt * this.turnSpeed)
                this.currentYaw = ((this.currentYaw + 540) % 360) - 180
                this.player.setLocalEulerAngles(0, this.currentYaw, 0)

                displacementX = this.moveDir.x * currentSpeed * dt
                displacementZ = this.moveDir.z * currentSpeed * dt
            }
        }

        this.player.setPosition(currentPos.x + displacementX, newY, currentPos.z + displacementZ)
    }
}

