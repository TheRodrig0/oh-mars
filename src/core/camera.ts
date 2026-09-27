import type { RaycastResult } from 'playcanvas'
import { Color, Entity, TONEMAP_ACES, Vec3 } from 'playcanvas'

import { LifeSupportEvent } from './enums/life-support-enums'
import type { Game } from './game'

export default class Camera extends Entity {
    private appInstance: Game
    private target: Entity | null = null

    public distance = 6.0
    public minDistance = 2.5
    public maxDistance = 14.0

    public yaw = 0
    public pitch = 18
    public maxPitch = 70
    public minHeightAboveGround = 0.4

    public sensitivity = 0.22
    public isDragging = false

    public keyTurnSpeed = 95.0
    public keyPitchSpeed = 65.0
    private activeArrowKeys = new Set<string>()

    private prevMouseX = 0
    private prevMouseY = 0

    public targetOffsetY = 0.6
    private focusPoint: Vec3 = new Vec3(0, 1.5, 0)
    private desiredFocus: Vec3 = new Vec3()

    public forwardHorizontal: Vec3 = new Vec3(0, 0, -1)
    public rightHorizontal: Vec3 = new Vec3(1, 0, 0)

    private rayStart: Vec3 = new Vec3()
    private rayEnd: Vec3 = new Vec3()

    private isTargetEntity(entity: Entity | null | undefined): boolean {
        if (!entity || !this.target) return false
        if (entity === this.target) return true
        let curr = entity.parent
        while (curr) {
            if (curr === this.target) return true
            curr = curr.parent
        }
        return false
    }

    private getGroundHeight(x: number, y: number, z: number): number {
        this.rayStart.set(x, y + 20.0, z)
        this.rayEnd.set(x, y - 80.0, z)
        const hits = this.appInstance.systems.rigidbody?.raycastAll(this.rayStart, this.rayEnd)
        if (hits && hits.length > 0) {
            let highest = -Infinity
            for (const hit of hits) {
                if (!this.isTargetEntity(hit.entity)) {
                    if (hit.point.y > highest) {
                        highest = hit.point.y
                    }
                }
            }
            if (highest !== -Infinity) {
                return highest
            }
        }
        return 0
    }

    constructor(app: Game) {
        super('MainCamera', app)
        this.appInstance = app

        const opts = app.gameOptions.camera
        this.distance = opts.distance
        this.minDistance = opts.minDistance
        this.maxDistance = opts.maxDistance
        this.pitch = opts.pitch
        this.yaw = opts.yaw
        this.maxPitch = opts.maxPitch
        this.minHeightAboveGround = opts.minHeightAboveGround
        this.sensitivity = opts.sensitivity
        this.keyTurnSpeed = opts.keyTurnSpeed
        this.keyPitchSpeed = opts.keyPitchSpeed

        this.onMouseDown = this.onMouseDown.bind(this)
        this.onMouseUp = this.onMouseUp.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)
        this.onWheel = this.onWheel.bind(this)
        this.onKeyDown = this.onKeyDown.bind(this)
        this.onKeyUp = this.onKeyUp.bind(this)
        this.onBlur = this.onBlur.bind(this)
        this.onGameOver = this.onGameOver.bind(this)
        this.onRespawn = this.onRespawn.bind(this)

        this.build()
        this.setupEvents()

        app.root.addChild(this)
    }

    private build(): void {
        this.addComponent('camera', {
            clearColor: new Color(0.82, 0.46, 0.28),
            nearClip: 0.1,
            farClip: 1200,
            fov: 50,
            toneMapping: TONEMAP_ACES
        })

        this.updateCameraVectors()
        this.appInstance.on('update', this.onPostUpdate, this)
    }

    private setupEvents(): void {
        const canvas = this.appInstance.graphicsDevice.canvas
        canvas.addEventListener('mousedown', this.onMouseDown)
        window.addEventListener('mouseup', this.onMouseUp)
        window.addEventListener('mousemove', this.onMouseMove)
        canvas.addEventListener('wheel', this.onWheel, { passive: true })
        window.addEventListener('keydown', this.onKeyDown)
        window.addEventListener('keyup', this.onKeyUp)
        window.addEventListener('blur', this.onBlur)

        this.appInstance.on(LifeSupportEvent.GAME_OVER, this.onGameOver, this)
        this.appInstance.on(LifeSupportEvent.RESPAWN, this.onRespawn, this)
    }

    private onGameOver(): void {
        this.targetOffsetY = 0.3
    }

    private onRespawn(): void {
        this.targetOffsetY = 0.6
        this.pitch = this.appInstance.gameOptions.camera.pitch
    }

    private onKeyDown(event: KeyboardEvent): void {
        const code = event.code.toLowerCase()
        const key = event.key.toLowerCase()

        if (
            code === 'arrowup' ||
            code === 'arrowdown' ||
            code === 'arrowleft' ||
            code === 'arrowright' ||
            key === 'arrowup' ||
            key === 'arrowdown' ||
            key === 'arrowleft' ||
            key === 'arrowright'
        ) {
            this.activeArrowKeys.add(code || key)
            event.preventDefault()
        }
    }

    private onKeyUp(event: KeyboardEvent): void {
        const code = event.code.toLowerCase()
        const key = event.key.toLowerCase()
        this.activeArrowKeys.delete(code)
        this.activeArrowKeys.delete(key)
    }

    private onBlur(): void {
        this.activeArrowKeys.clear()
    }

    public setTarget(target: Entity | null): void {
        this.target = target
        if (target) {
            const targetPos = target.getPosition()
            this.focusPoint.set(targetPos.x, targetPos.y + 1.5, targetPos.z)
            this.updateCameraTransform()
        }
    }

    private onMouseDown(event: MouseEvent): void {
        if (event.button === 0 || event.button === 2) {
            this.isDragging = true
        }

        this.prevMouseX = event.clientX
        this.prevMouseY = event.clientY

        const canvas = this.appInstance.graphicsDevice.canvas
        if (event.button === 0 && document.pointerLockElement !== canvas) {
            try {
                canvas.requestPointerLock()
            } catch {
                // Ignore pointer lock request failures
            }
        }
    }

    private onMouseUp(): void {
        this.isDragging = false
    }

    private onMouseMove(event: MouseEvent): void {
        const canvas = this.appInstance.graphicsDevice.canvas
        const isLocked = document.pointerLockElement === canvas

        if (!isLocked && !this.isDragging) {
            return
        }

        let deltaX = event.movementX
        let deltaY = event.movementY

        if (deltaX === undefined || deltaX === 0) {
            deltaX = event.clientX - this.prevMouseX
        }
        if (deltaY === undefined || deltaY === 0) {
            deltaY = event.clientY - this.prevMouseY
        }

        this.prevMouseX = event.clientX
        this.prevMouseY = event.clientY

        this.yaw -= deltaX * this.sensitivity
        const minPitchAllowed = this.getMinPitch()
        this.pitch = Math.max(minPitchAllowed, Math.min(this.maxPitch, this.pitch - deltaY * this.sensitivity))

        this.updateCameraVectors()
    }

    private onWheel(event: WheelEvent): void {
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + event.deltaY * 0.005))
        const minPitchAllowed = this.getMinPitch()
        if (this.pitch < minPitchAllowed) {
            this.pitch = minPitchAllowed
        }
    }

    public getMinPitch(): number {
        const groundY = this.getGroundHeight(this.focusPoint.x, this.focusPoint.y, this.focusPoint.z)
        const minSin = (groundY + this.minHeightAboveGround - this.focusPoint.y) / Math.max(0.1, this.distance)
        const clampedSin = Math.max(-0.99, Math.min(0.99, minSin))
        return (Math.asin(clampedSin) * 180) / Math.PI
    }

    private updateCameraVectors(): void {
        const radYaw = (this.yaw * Math.PI) / 180
        this.forwardHorizontal.set(-Math.sin(radYaw), 0, -Math.cos(radYaw)).normalize()
        this.rightHorizontal.set(Math.cos(radYaw), 0, -Math.sin(radYaw)).normalize()
    }

    private updateCameraTransform(): void {
        const radYaw = (this.yaw * Math.PI) / 180
        const radPitch = (this.pitch * Math.PI) / 180

        const cosPitch = Math.cos(radPitch)
        const sinPitch = Math.sin(radPitch)
        const cosYaw = Math.cos(radYaw)
        const sinYaw = Math.sin(radYaw)

        const offsetX = this.distance * sinYaw * cosPitch
        const offsetY = this.distance * sinPitch
        const offsetZ = this.distance * cosYaw * cosPitch

        const camX = this.focusPoint.x + offsetX
        const camZ = this.focusPoint.z + offsetZ
        const groundY = this.getGroundHeight(camX, this.focusPoint.y, camZ)
        const minCamY = groundY + this.minHeightAboveGround
        const desiredY = this.focusPoint.y + offsetY
        const camY = Math.max(minCamY, desiredY)

        this.rayStart.set(this.focusPoint.x, this.focusPoint.y, this.focusPoint.z)
        this.rayEnd.set(camX, camY, camZ)
        const hits = this.appInstance.systems.rigidbody?.raycastAll(this.rayStart, this.rayEnd)

        let closestHit: RaycastResult | null = null
        let closestDist = Infinity

        if (hits && hits.length > 0) {
            for (const hit of hits) {
                if (!this.isTargetEntity(hit.entity)) {
                    const dx = hit.point.x - this.focusPoint.x
                    const dy = hit.point.y - this.focusPoint.y
                    const dz = hit.point.z - this.focusPoint.z
                    const distSq = dx * dx + dy * dy + dz * dz
                    if (distSq < closestDist) {
                        closestDist = distSq
                        closestHit = hit
                    }
                }
            }
        }

        if (closestHit) {
            const dirX = closestHit.point.x - this.focusPoint.x
            const dirY = closestHit.point.y - this.focusPoint.y
            const dirZ = closestHit.point.z - this.focusPoint.z
            const len = Math.sqrt(closestDist)
            if (len > 0.001) {
                const buffer = 0.3
                const safeDist = Math.max(0.5, len - buffer)
                this.setPosition(
                    this.focusPoint.x + (dirX / len) * safeDist,
                    Math.max(groundY + this.minHeightAboveGround, this.focusPoint.y + (dirY / len) * safeDist),
                    this.focusPoint.z + (dirZ / len) * safeDist
                )
            } else {
                this.setPosition(camX, camY, camZ)
            }
        } else {
            this.setPosition(camX, camY, camZ)
        }

        this.lookAt(this.focusPoint)
    }

    private onPostUpdate(dt?: number): void {
        const delta = typeof dt === 'number' && dt > 0 ? dt : 0.016

        if (this.activeArrowKeys.size > 0) {
            if (this.activeArrowKeys.has('arrowleft')) {
                this.yaw += this.keyTurnSpeed * delta
            }
            if (this.activeArrowKeys.has('arrowright')) {
                this.yaw -= this.keyTurnSpeed * delta
            }
            if (this.activeArrowKeys.has('arrowup')) {
                this.pitch = Math.min(this.maxPitch, this.pitch + this.keyPitchSpeed * delta)
            }
            if (this.activeArrowKeys.has('arrowdown')) {
                const minPitchAllowed = this.getMinPitch()
                this.pitch = Math.max(minPitchAllowed, this.pitch - this.keyPitchSpeed * delta)
            }
        }

        if (!this.target) {
            this.updateCameraVectors()
            this.updateCameraTransform()
            return
        }

        const targetPos = this.target.getPosition()
        this.desiredFocus.set(targetPos.x, targetPos.y + this.targetOffsetY, targetPos.z)
        this.focusPoint.lerp(this.focusPoint, this.desiredFocus, 0.18)

        const minPitchAllowed = this.getMinPitch()
        if (this.pitch < minPitchAllowed) {
            this.pitch = minPitchAllowed
        }

        this.updateCameraVectors()
        this.updateCameraTransform()
    }

    public override destroy(): void {
        const canvas = this.appInstance.graphicsDevice.canvas
        canvas.removeEventListener('mousedown', this.onMouseDown)
        window.removeEventListener('mouseup', this.onMouseUp)
        window.removeEventListener('mousemove', this.onMouseMove)
        canvas.removeEventListener('wheel', this.onWheel)
        window.removeEventListener('keydown', this.onKeyDown)
        window.removeEventListener('keyup', this.onKeyUp)
        window.removeEventListener('blur', this.onBlur)

        this.appInstance.off(LifeSupportEvent.GAME_OVER, this.onGameOver, this)
        this.appInstance.off(LifeSupportEvent.RESPAWN, this.onRespawn, this)
        this.appInstance.off('update', this.onPostUpdate, this)
        super.destroy()
    }
}
