import type {
    AppBase,
    Asset,
    ContainerResource,
    MeshInstance,
    RenderComponent,
    Texture
} from 'playcanvas';
import {
    AnimStateGraph,
    AnimTrack,
    Animation as PcAnimation,
    Color,
    Entity,
    StandardMaterial,
    Vec3
} from 'playcanvas';

import type Camera from '../core/camera';

export default class Player extends Entity {
    private appInstance: AppBase;
    private camera: Camera;

    // Velocidades de locomoção calibradas (m/s)
    private speedWalk = 3.2;
    private speedRun = 7.0;
    private turnSpeed = 15.0;

    // Física e salto
    private gravity = 18.0;
    private jumpForce = 6.8;
    private verticalVelocity = 0;
    private isGrounded = true;

    // Rastreamento das teclas de controle
    private activeKeys = new Set<string>();

    // Vetores de cálculo (reutilizados a cada frame para zero alocação)
    private moveDir = new Vec3();
    private currentYaw = 0;

    private modelEntity: Entity | null = null;
    private baseTexture: Texture | null = null;
    private animClips: Record<string, string> = {};
    private currentAnimState: 'Idle' | 'Walk' | 'Run' | 'Jump' = 'Idle';

    constructor(app: AppBase, camera: Camera) {
        super('Player', app);
        this.appInstance = app;
        this.camera = camera;

        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onBlur = this.onBlur.bind(this);
        this.onUpdate = this.onUpdate.bind(this);

        this.build();
        this.setupInput();

        app.root.addChild(this);
        camera.setTarget(this);
    }

    private build(): void {
        this.setPosition(0, 0, 0);
        this.loadAstronaut();
        this.appInstance.on('update', this.onUpdate, this);
    }

    private loadAstronaut(): void {
        // Carrega a textura difusa
        this.appInstance.assets.loadFromUrl(
            '/models/astronaut/Astronaut_BaseColor.png',
            'texture',
            (err, asset) => {
                if (!err && asset?.resource) {
                    this.baseTexture = asset.resource as Texture;
                    if (this.modelEntity) {
                        this.applyMaterialToEntity(this.modelEntity, this.baseTexture);
                    }
                }
            }
        );

        // Carrega o container GLB do astronauta
        this.appInstance.assets.loadFromUrl(
            '/models/astronaut/astronaut.glb',
            'container',
            (err, asset) => {
                if (err || !asset?.resource) {
                    console.error('Erro ao carregar modelo do astronauta:', err);
                    return;
                }
                const container = asset.resource as ContainerResource;
                this.setupAstronautModel(container);
            }
        );
    }

    private setupAstronautModel(container: ContainerResource): void {
        let entity: Entity | null = null;

        try {
            entity = container.instantiateModelEntity();
        } catch {
            entity = null;
        }

        if (!entity || !entity.model) {
            try {
                entity = container.instantiateRenderEntity();
            } catch (e) {
                console.error('Falha ao instanciar hierarquia renderizável:', e);
                return;
            }
        }

        if (!entity) return;

        this.modelEntity = entity;

        // Escala calibrada: altura original ~0.0402m no GLB -> escala 45 resulta em ~1.8m
        const uniformScale = 45;
        entity.setLocalScale(uniformScale, uniformScale, uniformScale);
        entity.setLocalPosition(0, 0, 0);

        // O astronauta no GLB Mixamo tem sua face apontando para +Z local.
        // Rotacionando 180 graus em Y, a face do modelo fica alinhada com o -Z (forward nativo do PlayCanvas).
        // Assim, quando o Player gira para onde quer andar, o astronauta olha e corre exatamente para a frente.
        entity.setLocalEulerAngles(0, 180, 0);

        if (this.baseTexture) {
            this.applyMaterialToEntity(entity, this.baseTexture);
        }

        this.setupAnimations(entity, container);

        this.addChild(entity);
        this.camera.setTarget(this);
    }

    private applyMaterialToEntity(entity: Entity, texture: Texture): void {
        const mat = new StandardMaterial();
        mat.diffuseMap = texture;
        mat.diffuse = new Color(1, 1, 1);
        mat.gloss = 0.35;
        mat.metalness = 0.15;
        mat.useMetalness = true;
        mat.update();

        if (entity.model?.meshInstances) {
            entity.model.meshInstances.forEach((mi: MeshInstance) => {
                mi.material = mat;
                mi.castShadow = true;
                mi.receiveShadow = true;
            });
            entity.model.castShadows = true;
            entity.model.receiveShadows = true;
        }

        const renders = entity.findComponents('render') as RenderComponent[];
        renders.forEach((renderComp) => {
            renderComp.castShadows = true;
            renderComp.receiveShadows = true;
            if (renderComp.meshInstances) {
                renderComp.meshInstances.forEach((mi: MeshInstance) => {
                    mi.material = mat;
                    mi.castShadow = true;
                    mi.receiveShadow = true;
                });
            }
        });
    }

    /**
     * Remove root motion nas trilhas modernas (AnimTrack).
     * Mantém a raiz no lugar para que TODO o deslocamento seja gerido exclusivamente pelo código.
     */
    private stripRootMotionFromTrack(track: AnimTrack, stripVertical = false): void {
        if (!track || !track.curves) return;

        track.curves.forEach((curve) => {
            const isHipsTranslation = curve.paths.some(
                (p) =>
                    p.propertyPath &&
                    p.propertyPath[0] === 'localPosition' &&
                    p.entityPath.some((seg) => seg.toLowerCase().includes('hips'))
            );

            if (!isHipsTranslation) return;

            const outputData = track.outputs[curve.output];
            if (!outputData || outputData.components !== 3) return;

            const d = outputData.data;
            const initX = d[0];
            const initY = d[1];
            const initZ = d[2];

            for (let i = 0; i < d.length; i += 3) {
                d[i] = initX;
                d[i + 1] = initY; // neutraliza avanço da animação
                if (stripVertical) {
                    d[i + 2] = initZ; // neutraliza elevação do clipe de pulo
                }
            }
        });
    }

    /**
     * Remove root motion nas animações legadas (pc.Animation).
     */
    private stripRootMotionFromLegacyAnimation(anim: PcAnimation, stripVertical = false): void {
        if (!anim || !anim.nodes) return;

        const hipsNode = anim.getNode('mixamorig:Hips') || anim.nodes.find((n) => n._name?.toLowerCase().includes('hips'));
        if (!hipsNode || !hipsNode._keys || hipsNode._keys.length === 0) return;

        const firstPos = hipsNode._keys[0].position;
        if (!firstPos) return;

        const initX = firstPos.x;
        const initY = firstPos.y;
        const initZ = firstPos.z;

        for (const k of hipsNode._keys) {
            if (k.position) {
                k.position.x = initX;
                k.position.y = initY;
                if (stripVertical) {
                    k.position.z = initZ;
                }
            }
        }
    }

    private setupAnimations(entity: Entity, container: ContainerResource): void {
        const animAssets = (container.animations || []) as Asset[];
        if (animAssets.length === 0) return;

        // No GLB do astronauta:
        // Index 0: Armature|mixamo.com|Layer0     -> IDLE
        // Index 1: Armature|mixamo.com|Layer0.001 -> RUNNING (cadência alta, corrida)
        // Index 2: Armature|mixamo.com|Layer0.002 -> WALKING (cadência normal, caminhada)
        // Index 3: Armature|mixamo.com|Layer0.003 -> JUMP
        const idleAsset =
            animAssets.find((a) => a.name.includes('Layer0') && !a.name.includes('.')) || animAssets[0];
        const walkAsset =
            animAssets.find((a) => a.name.includes('Layer0.002')) || animAssets[2] || idleAsset;
        const runAsset =
            animAssets.find((a) => a.name.includes('Layer0.001')) || animAssets[1] || walkAsset;
        const jumpAsset =
            animAssets.find((a) => a.name.includes('Layer0.003')) || animAssets[3] || idleAsset;

        this.animClips = {
            Idle: idleAsset.name,
            Walk: walkAsset.name,
            Run: runAsset.name,
            Jump: jumpAsset.name
        };

        // Remove Root Motion
        animAssets.forEach((asset) => {
            const res = asset.resource;
            if (!res) return;

            const isJump = asset === jumpAsset || asset.name.includes('003');

            if (res instanceof AnimTrack) {
                this.stripRootMotionFromTrack(res, isJump);
            } else if (res instanceof PcAnimation) {
                this.stripRootMotionFromLegacyAnimation(res, isJump);
            }
        });

        // Configura animação nativa
        if (entity.model) {
            entity.addComponent('animation', {
                assets: animAssets,
                speed: 1.0,
                loop: true,
                activate: true
            });

            if (entity.animation) {
                entity.animation.play(this.animClips.Idle, 0.2);
            }
            return;
        }

        const animStateGraph = new AnimStateGraph({
            layers: [
                {
                    name: 'Base',
                    states: [
                        { name: 'START' },
                        { name: 'Idle', speed: 1.0, loop: true, defaultState: true },
                        { name: 'Walk', speed: 1.0, loop: true },
                        { name: 'Run', speed: 1.0, loop: true },
                        { name: 'Jump', speed: 1.0, loop: false }
                    ],
                    transitions: [
                        { from: 'START', to: 'Idle' },
                        { from: 'Idle', to: 'Walk', time: 0.15 },
                        { from: 'Walk', to: 'Idle', time: 0.15 },
                        { from: 'Walk', to: 'Run', time: 0.15 },
                        { from: 'Run', to: 'Walk', time: 0.15 },
                        { from: 'Idle', to: 'Run', time: 0.15 },
                        { from: 'Run', to: 'Idle', time: 0.15 },
                        { from: 'Idle', to: 'Jump', time: 0.1 },
                        { from: 'Walk', to: 'Jump', time: 0.1 },
                        { from: 'Run', to: 'Jump', time: 0.1 },
                        { from: 'Jump', to: 'Idle', time: 0.2 },
                        { from: 'Jump', to: 'Walk', time: 0.2 },
                        { from: 'Jump', to: 'Run', time: 0.2 }
                    ]
                }
            ],
            parameters: {}
        });

        entity.addComponent('anim', {
            activate: true,
            speed: 1.0
        });

        entity.anim?.loadStateGraph(animStateGraph);
        if (idleAsset.resource) entity.anim?.assignAnimation('Idle', idleAsset.resource);
        if (walkAsset.resource) entity.anim?.assignAnimation('Walk', walkAsset.resource);
        if (runAsset.resource) entity.anim?.assignAnimation('Run', runAsset.resource);
        if (jumpAsset.resource) entity.anim?.assignAnimation('Jump', jumpAsset.resource);
    }

    private setupInput(): void {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);
    }

    private onBlur(): void {
        this.activeKeys.clear();
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.code) this.activeKeys.add(e.code.toLowerCase());
        if (e.key) this.activeKeys.add(e.key.toLowerCase());

        if (e.code === 'Space' || e.key === ' ') {
            this.triggerJump();
        }
    }

    private onKeyUp(e: KeyboardEvent): void {
        if (e.code) this.activeKeys.delete(e.code.toLowerCase());
        if (e.key) this.activeKeys.delete(e.key.toLowerCase());
    }

    private isKeyActive(...keys: string[]): boolean {
        return keys.some((k) => this.activeKeys.has(k.toLowerCase()));
    }

    private triggerJump(): void {
        if (this.isGrounded) {
            this.isGrounded = false;
            this.verticalVelocity = this.jumpForce;
            this.playAnimation('Jump');
        }
    }

    private playAnimation(stateName: 'Idle' | 'Walk' | 'Run' | 'Jump'): void {
        if (this.currentAnimState === stateName) return;
        this.currentAnimState = stateName;

        const clipName = this.animClips[stateName];

        if (this.modelEntity?.animation && clipName) {
            this.modelEntity.animation.loop = stateName !== 'Jump';
            this.modelEntity.animation.play(clipName, 0.2);
            return;
        }

        if (this.modelEntity?.anim?.baseLayer) {
            try {
                this.modelEntity.anim.baseLayer.transition(stateName, 0.15);
            } catch {
                this.modelEntity.anim.baseLayer.play(stateName);
            }
        }
    }

    private onUpdate(dt: number): void {
        // Movimentação do personagem controlada exclusivamente por WASD e variantes (Z/Q)
        const moveForward = this.isKeyActive('KeyW', 'w', 'KeyZ', 'z');
        const moveBackward = this.isKeyActive('KeyS', 's');
        const moveLeft = this.isKeyActive('KeyA', 'a', 'KeyQ', 'q');
        const moveRight = this.isKeyActive('KeyD', 'd');
        const isRunHolding = this.isKeyActive('ShiftLeft', 'ShiftRight', 'shift');

        const forwardInput = (moveForward ? 1 : 0) - (moveBackward ? 1 : 0);
        const sideInput = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);

        const isMoving = forwardInput !== 0 || sideInput !== 0;
        const isRunning = isRunHolding && isMoving;

        const currentPos = this.getPosition();
        let newY = currentPos.y;

        // Gravidade e salto
        if (!this.isGrounded) {
            this.verticalVelocity -= this.gravity * dt;
            newY += this.verticalVelocity * dt;

            if (newY <= 0) {
                newY = 0;
                this.verticalVelocity = 0;
                this.isGrounded = true;

                if (isMoving) {
                    this.playAnimation(isRunning ? 'Run' : 'Walk');
                } else {
                    this.playAnimation('Idle');
                }
            } else {
                this.playAnimation('Jump');
            }
        } else {
            if (isMoving) {
                this.playAnimation(isRunning ? 'Run' : 'Walk');
            } else {
                this.playAnimation('Idle');
            }
        }

        // Movimentação alinhada exatamente ao ponto de vista da câmera
        if (isMoving) {
            const currentSpeed = isRunning ? this.speedRun : this.speedWalk;

            // Obtém os vetores horizontalmente projetados da câmera
            const camForward = this.camera.forwardHorizontal;
            const camRight = this.camera.rightHorizontal;

            // moveDir = camForward * forwardInput + camRight * sideInput
            this.moveDir.set(
                camForward.x * forwardInput + camRight.x * sideInput,
                0,
                camForward.z * forwardInput + camRight.z * sideInput
            );

            if (this.moveDir.lengthSq() > 0.0001) {
                this.moveDir.normalize();

                // Em PlayCanvas:
                // Se a entidade tem rotação yaw em Y, sua direção frontal é (-sin(yaw), 0, -cos(yaw)).
                // Queremos que a direção frontal coincida com moveDir (mx, 0, mz):
                // -sin(yaw) = mx  =>  sin(yaw) = -mx
                // -cos(yaw) = mz  =>  cos(yaw) = -mz
                // yaw = Math.atan2(-mx, -mz) radianos
                const targetYaw = Math.atan2(-this.moveDir.x, -this.moveDir.z) * (180 / Math.PI);
                
                // Calculamos o menor delta angular relativo ao currentYaw interno
                // (evitando ler getLocalEulerAngles() que sofre de decomposição com gimbal flip [180, 0, 180] para rotações traseiras)
                const deltaYaw = ((targetYaw - this.currentYaw + 540) % 360) - 180;
                this.currentYaw += deltaYaw * Math.min(1, dt * this.turnSpeed);
                this.currentYaw = ((this.currentYaw + 540) % 360) - 180;
                this.setLocalEulerAngles(0, this.currentYaw, 0);

                // Aplica deslocamento rigorosamente na direção calculada
                const displacementX = this.moveDir.x * currentSpeed * dt;
                const displacementZ = this.moveDir.z * currentSpeed * dt;
                this.setPosition(currentPos.x + displacementX, newY, currentPos.z + displacementZ);
            } else {
                this.setPosition(currentPos.x, newY, currentPos.z);
            }
        } else {
            this.setPosition(currentPos.x, newY, currentPos.z);
        }
    }

    public override destroy(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.onBlur);
        this.appInstance.off('update', this.onUpdate, this);
        super.destroy();
    }
}
