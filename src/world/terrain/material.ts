import { Color, StandardMaterial } from 'playcanvas'

export const MarsPalette = {
    SURFACE_RED: new Color(0.92, 0.22, 0.14), // Vermelho marciano vivo e rico (topo iluminado das dunas)
    SLOPE_RUST: new Color(0.82, 0.18, 0.12), // Ferrugem avermelhada rica / hematita
    CRIMSON_SHADOW: new Color(0.70, 0.14, 0.11), // Encostas e sombras carmesim
    CRATER_HEMATITE: new Color(0.56, 0.12, 0.12), // Interior de crateras e cortes
    DEEP_BASALT: new Color(0.38, 0.10, 0.14), // Basalto subterrâneo
    CORE_ABYSS: new Color(0.22, 0.06, 0.12) // Abismo profundo
} as const

/**
 * Cria o material lowpoly puro para o terreno marciano, sem mapas difusos,
 * utilizando cores de vértice facetadas e luz ambiente avermelhada de Marte.
 */
export function createTerrainMaterial(): StandardMaterial {
    const material = new StandardMaterial()
    material.diffuse = new Color(1, 1, 1)
    material.diffuseVertexColor = true
    material.specular = new Color(0.08, 0.04, 0.03)
    material.gloss = 0.1
    material.metalness = 0.0
    // Luz ambiente avermelhada de Marte para preenchimento quente das sombras
    material.ambient = new Color(0.36, 0.14, 0.12)
    material.useLighting = true
    material.cull = 1 // CULLFACE_BACK
    material.update()
    return material
}
