import RealityKit
import UIKit

extension Entity {

    /// Apply lighting to this entity for VR immersive scenes.
    /// Tries a bundled IBL resource first, falls back to bright directional lights.
    func applyImageBasedLighting(named resourceName: String = "studio") async throws {
        // Try bundled .skybox environment resource
        if let resource = try? await EnvironmentResource(named: resourceName) {
            components.set(ImageBasedLightComponent(source: .single(resource), intensityExponent: 4.0))
            components.set(ImageBasedLightReceiverComponent(imageBasedLight: self))
            return
        }

        // No bundled IBL resource — add directional lights as fallback
        // visionOS doesn't have automatic lighting in fully immersive scenes,
        // so we must add lights manually for PBR materials to be visible.

        // Main sun light (bright warm white, from upper-front-left)
        let sunLight = Entity()
        var sunComp = DirectionalLightComponent()
        sunComp.color = .white
        sunComp.intensity = 15000
        sunLight.components.set(sunComp)
        sunLight.orientation = simd_quatf(
            angle: -.pi / 4,  // 45° down
            axis: SIMD3<Float>(1, 0, 0)
        ) * simd_quatf(
            angle: .pi / 6,   // 30° from left
            axis: SIMD3<Float>(0, 1, 0)
        )
        sunLight.name = "SunLight"
        addChild(sunLight)

        // Fill light (slightly cool, from front-right — lifts shadows)
        let fillLight = Entity()
        var fillComp = DirectionalLightComponent()
        fillComp.color = UIColor(red: 0.9, green: 0.92, blue: 1.0, alpha: 1.0)
        fillComp.intensity = 8000
        fillLight.components.set(fillComp)
        fillLight.orientation = simd_quatf(
            angle: -.pi / 6,  // 30° down
            axis: SIMD3<Float>(1, 0, 0)
        ) * simd_quatf(
            angle: -.pi / 3,  // 60° from right
            axis: SIMD3<Float>(0, 1, 0)
        )
        fillLight.name = "FillLight"
        addChild(fillLight)

        // Back/rim light (warm, from behind-above — adds depth)
        let backLight = Entity()
        var backComp = DirectionalLightComponent()
        backComp.color = UIColor(red: 1.0, green: 0.95, blue: 0.85, alpha: 1.0)
        backComp.intensity = 5000
        backLight.components.set(backComp)
        backLight.orientation = simd_quatf(
            angle: .pi,       // from behind
            axis: SIMD3<Float>(0, 1, 0)
        ) * simd_quatf(
            angle: -.pi / 5,  // slightly downward
            axis: SIMD3<Float>(1, 0, 0)
        )
        backLight.name = "BackLight"
        addChild(backLight)
    }
}
