import type {
    AppBase } from 'playcanvas';
import {
    Color,
    Entity,
    TONEMAP_ACES,
    Vec3
} from 'playcanvas';

export default class Camera extends Entity {
    private appInstance: AppBase;
    private target: Entity | null = null;

    public distance = 6.0;
    public minDistance = 2.5;
    public maxDistance = 14.0;

    public yaw = 0;
    public pitch = 18;
    public maxPitch = 70;
    public minHeightAboveGround = 0.4; // Altura mínima de segurança acima do chão (Y = 0)

    public sensitivity = 0.22;
    public isDragging = false;

    // Velocidades de rotação da câmera pelas teclas de seta
    public keyTurnSpeed = 95.0; // graus por segundo
    public keyPitchSpeed = 65.0; // graus por segundo
    private activeArrowKeys = new Set<string>();

    private prevMouseX = 0;
    private prevMouseY = 0;

    private focusPoint: Vec3 = new Vec3(0, 1.5, 0);
    private desiredFocus: Vec3 = new Vec3();

    // Vetores pré-alocados para cálculo de direção relativa
    public forwardHorizontal: Vec3 = new Vec3(0, 0, -1);
    public rightHorizontal: Vec3 = new Vec3(1, 0, 0);

    constructor(app: AppBase) {
        super('MainCamera', app);
        this.appInstance = app;

        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onBlur = this.onBlur.bind(this);

        this.build();
        this.setupEvents();

        app.root.addChild(this);
    }

    private build(): void {
        this.addComponent('camera', {
            clearColor: new Color(0.82, 0.46, 0.28),
            farClip: 1200,
            fov: 50,
            toneMapping: TONEMAP_ACES
        });

        this.updateCameraVectors();
        this.appInstance.on('update', this.onPostUpdate, this);
    }

    private setupEvents(): void {
        const canvas = this.appInstance.graphicsDevice.canvas;
        canvas.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('wheel', this.onWheel, { passive: true });
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);
    }

    private onKeyDown(event: KeyboardEvent): void {
        const code = event.code.toLowerCase();
        const key = event.key.toLowerCase();

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
            this.activeArrowKeys.add(code || key);
            event.preventDefault();
        }
    }

    private onKeyUp(event: KeyboardEvent): void {
        const code = event.code.toLowerCase();
        const key = event.key.toLowerCase();
        this.activeArrowKeys.delete(code);
        this.activeArrowKeys.delete(key);
    }

    private onBlur(): void {
        this.activeArrowKeys.clear();
    }

    public setTarget(target: Entity | null): void {
        this.target = target;
        if (target) {
            const targetPos = target.getPosition();
            this.focusPoint.set(targetPos.x, targetPos.y + 1.5, targetPos.z);
            this.updateCameraTransform();
        }
    }

    private onMouseDown(event: MouseEvent): void {
        if (event.button === 0 || event.button === 2) {
            this.isDragging = true;
        }

        this.prevMouseX = event.clientX;
        this.prevMouseY = event.clientY;

        const canvas = this.appInstance.graphicsDevice.canvas;
        if (event.button === 0 && document.pointerLockElement !== canvas) {
            try {
                canvas.requestPointerLock();
            } catch {
                // Ignore pointer lock errors if rejected by browser
            }
        }
    }

    private onMouseUp(): void {
        this.isDragging = false;
    }

    private onMouseMove(event: MouseEvent): void {
        const canvas = this.appInstance.graphicsDevice.canvas;
        const isLocked = document.pointerLockElement === canvas;

        if (!isLocked && !this.isDragging) {
            return;
        }

        let deltaX = event.movementX;
        let deltaY = event.movementY;

        if (deltaX === undefined || deltaX === 0) {
            deltaX = event.clientX - this.prevMouseX;
        }
        if (deltaY === undefined || deltaY === 0) {
            deltaY = event.clientY - this.prevMouseY;
        }

        this.prevMouseX = event.clientX;
        this.prevMouseY = event.clientY;

        this.yaw -= deltaX * this.sensitivity;
        const minPitchAllowed = this.getMinPitch();
        this.pitch = Math.max(minPitchAllowed, Math.min(this.maxPitch, this.pitch - deltaY * this.sensitivity));

        this.updateCameraVectors();
    }

    private onWheel(event: WheelEvent): void {
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + event.deltaY * 0.005));
        const minPitchAllowed = this.getMinPitch();
        if (this.pitch < minPitchAllowed) {
            this.pitch = minPitchAllowed;
        }
    }

    /**
     * Calcula o pitch mínimo dinâmico com base na distância e na altura do alvo,
     * impedindo rigorosamente que a câmera ultrapasse ou encoste no chão (plano Y = 0).
     */
    public getMinPitch(): number {
        const minSin = (this.minHeightAboveGround - this.focusPoint.y) / Math.max(0.1, this.distance);
        const clampedSin = Math.max(-0.99, Math.min(0.99, minSin));
        return (Math.asin(clampedSin) * 180) / Math.PI;
    }

    /**
     * Atualiza os vetores direcionais da câmera projetados no plano horizontal (XZ).
     * O Player consulta diretamente estes vetores para saber exatamente para onde
     * 'W' (frente), 'S' (trás), 'A' (esquerda) e 'D' (direita) devem mover.
     */
    private updateCameraVectors(): void {
        const radYaw = (this.yaw * Math.PI) / 180;
        // Frente da câmera no solo: quando yaw=0, a câmera está atrás em +Z olhando para -Z
        this.forwardHorizontal.set(-Math.sin(radYaw), 0, -Math.cos(radYaw)).normalize();
        // Direita da câmera no solo: vetor perpendicular no plano XZ
        this.rightHorizontal.set(Math.cos(radYaw), 0, -Math.sin(radYaw)).normalize();
    }

    private updateCameraTransform(): void {
        const radYaw = (this.yaw * Math.PI) / 180;
        const radPitch = (this.pitch * Math.PI) / 180;

        const cosPitch = Math.cos(radPitch);
        const sinPitch = Math.sin(radPitch);
        const cosYaw = Math.cos(radYaw);
        const sinYaw = Math.sin(radYaw);

        const offsetX = this.distance * sinYaw * cosPitch;
        const offsetY = this.distance * sinPitch;
        const offsetZ = this.distance * cosYaw * cosPitch;

        // Trava física de altura garantindo que a câmera nunca fique abaixo de minHeightAboveGround
        const camX = this.focusPoint.x + offsetX;
        const camY = Math.max(this.minHeightAboveGround, this.focusPoint.y + offsetY);
        const camZ = this.focusPoint.z + offsetZ;

        this.setPosition(camX, camY, camZ);
        this.lookAt(this.focusPoint);
    }

    private onPostUpdate(dt?: number): void {
        const delta = typeof dt === 'number' && dt > 0 ? dt : 0.016;

        // Controle da câmera via teclas de seta
        if (this.activeArrowKeys.size > 0) {
            if (this.activeArrowKeys.has('arrowleft')) {
                this.yaw += this.keyTurnSpeed * delta;
            }
            if (this.activeArrowKeys.has('arrowright')) {
                this.yaw -= this.keyTurnSpeed * delta;
            }
            if (this.activeArrowKeys.has('arrowup')) {
                this.pitch = Math.min(this.maxPitch, this.pitch + this.keyPitchSpeed * delta);
            }
            if (this.activeArrowKeys.has('arrowdown')) {
                const minPitchAllowed = this.getMinPitch();
                this.pitch = Math.max(minPitchAllowed, this.pitch - this.keyPitchSpeed * delta);
            }
        }

        if (!this.target) {
            this.updateCameraVectors();
            this.updateCameraTransform();
            return;
        }

        const targetPos = this.target.getPosition();
        this.desiredFocus.set(targetPos.x, targetPos.y + 1.5, targetPos.z);
        this.focusPoint.lerp(this.focusPoint, this.desiredFocus, 0.18);

        // Se o alvo mudar de elevação (ex: pulo ou aterrissagem), ajusta o limite inferior de pitch
        const minPitchAllowed = this.getMinPitch();
        if (this.pitch < minPitchAllowed) {
            this.pitch = minPitchAllowed;
        }

        this.updateCameraVectors();
        this.updateCameraTransform();
    }

    public override destroy(): void {
        const canvas = this.appInstance.graphicsDevice.canvas;
        canvas.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('wheel', this.onWheel);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.onBlur);

        this.appInstance.off('update', this.onPostUpdate, this);
        super.destroy();
    }
}
