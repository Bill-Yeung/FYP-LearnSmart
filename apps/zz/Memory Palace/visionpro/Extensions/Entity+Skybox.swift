import RealityKit
import UIKit
import CoreGraphics
import Foundation

extension Entity {

    /// Create a skybox dome from a bundled preset image name.
    /// Falls back to a procedural skybox if the image is not found.
    static func createSkybox(named imageName: String) async throws -> Entity {
        if let url = Bundle.main.url(forResource: imageName, withExtension: "jpg")
            ?? Bundle.main.url(forResource: imageName, withExtension: "png")
            ?? Bundle.main.url(forResource: imageName, withExtension: "jpeg") {
            return try await createSkybox(from: url)
        }
        // No bundled image — use procedural color skybox
        return createProceduralSkybox(preset: imageName)
    }

    /// Create a skybox dome from a URL (local file or remote).
    static func createSkybox(from url: URL) async throws -> Entity {
        let texture: TextureResource
        if url.isFileURL {
            texture = try await TextureResource(contentsOf: url)
        } else {
            let (tempURL, _) = try await URLSession.shared.download(from: url)
            texture = try await TextureResource(contentsOf: tempURL)
        }

        let mesh = MeshResource.generateSphere(radius: 500)
        var material = UnlitMaterial()
        material.color = .init(texture: .init(texture))

        let skyboxEntity = Entity()
        skyboxEntity.components.set(ModelComponent(mesh: mesh, materials: [material]))
        skyboxEntity.scale = .init(x: -1, y: 1, z: 1)
        skyboxEntity.name = "Skybox"
        return skyboxEntity
    }

    /// Create a procedural gradient skybox with colors based on the preset name.
    /// No image files required — generates a texture at runtime.
    static func createProceduralSkybox(preset: String) -> Entity {
        let colors = skyboxColors(for: preset)
        let isGarden = (preset == "garden")

        let width = 2048
        let height = 1024
        var pixels = [UInt8](repeating: 0, count: width * height * 4)

        // Sun position (normalized x in equirectangular)
        let sunX: Float = 0.25  // 90° from center
        let sunY: Float = 0.35  // slightly above horizon

        for y in 0..<height {
            let ty = Float(y) / Float(height - 1) // 0 = top (zenith), 1 = bottom (nadir)
            for x in 0..<width {
                let tx = Float(x) / Float(width - 1) // 0..1 across equirectangular

                var r: Float, g: Float, b: Float

                if ty < 0.45 {
                    // Sky region
                    let blend = ty / 0.45
                    r = colors.sky.0 * (1 - blend) + colors.horizon.0 * blend
                    g = colors.sky.1 * (1 - blend) + colors.horizon.1 * blend
                    b = colors.sky.2 * (1 - blend) + colors.horizon.2 * blend
                } else if ty < 0.55 {
                    // Horizon band
                    let blend = (ty - 0.45) / 0.10
                    r = colors.horizon.0
                    g = colors.horizon.1
                    b = colors.horizon.2
                    // Warm glow at horizon
                    if isGarden {
                        let warmth: Float = 0.08 * (1.0 - abs(blend - 0.5) * 2.0)
                        r += warmth * 1.2; g += warmth * 0.8; b -= warmth * 0.3
                    }
                } else {
                    // Ground region
                    let blend = (ty - 0.55) / 0.45
                    r = colors.horizon.0 * (1 - blend) + colors.ground.0 * blend
                    g = colors.horizon.1 * (1 - blend) + colors.ground.1 * blend
                    b = colors.horizon.2 * (1 - blend) + colors.ground.2 * blend
                }

                if isGarden {
                    // Sun glow — warm circle near horizon
                    let dx = tx - sunX
                    let dy = ty - sunY
                    let distSq = dx * dx + dy * dy
                    let sunGlow = max(0, 1.0 - distSq * 25.0) // tight glow
                    let haloGlow = max(0, 1.0 - distSq * 5.0)  // wider halo
                    r += sunGlow * 0.9 + haloGlow * 0.15
                    g += sunGlow * 0.8 + haloGlow * 0.10
                    b += sunGlow * 0.4 + haloGlow * 0.02

                    // Cloud-like noise in sky region
                    if ty < 0.48 {
                        let nx = Float(x) * 0.02
                        let ny = Float(y) * 0.03
                        let noise = (sin(nx) * cos(ny * 1.3) + sin(nx * 2.1 + 1.7) * cos(ny * 0.7 + 2.3)) * 0.5
                        let cloudFactor = max(0, noise) * 0.15 * (1.0 - ty / 0.48) // stronger near top
                        r += cloudFactor; g += cloudFactor; b += cloudFactor
                    }

                    // Ground variation (grass patches)
                    if ty > 0.55 {
                        let gnx = Float(x) * 0.015
                        let gny = Float(y) * 0.025
                        let groundNoise = sin(gnx * 3.7) * cos(gny * 2.9) * 0.06
                        g += groundNoise // slight green variation
                        r += groundNoise * 0.3
                    }

                    // Tree silhouettes near horizon
                    if ty > 0.47 && ty < 0.56 {
                        let treeNoise = sin(Float(x) * 0.08) * 0.5
                            + sin(Float(x) * 0.2 + 1.0) * 0.3
                            + sin(Float(x) * 0.5 + 3.0) * 0.2
                        let treeHeight: Float = 0.52 + treeNoise * 0.03
                        if ty > treeHeight && ty < treeHeight + 0.02 {
                            // Dark green tree silhouette
                            r = r * 0.3 + 0.05
                            g = g * 0.4 + 0.10
                            b = b * 0.2 + 0.02
                        }
                    }
                }

                // Clamp
                r = min(max(r, 0), 1); g = min(max(g, 0), 1); b = min(max(b, 0), 1)

                let idx = (y * width + x) * 4
                pixels[idx]     = UInt8(r * 255)
                pixels[idx + 1] = UInt8(g * 255)
                pixels[idx + 2] = UInt8(b * 255)
                pixels[idx + 3] = 255
            }
        }

        let mesh = MeshResource.generateSphere(radius: 500)
        var material = UnlitMaterial()

        if let cgImage = createCGImage(pixels: pixels, width: width, height: height),
           let texture = try? TextureResource(image: cgImage, options: .init(semantic: .color)) {
            material.color = .init(texture: .init(texture))
        } else {
            material.color = .init(tint: UIColor(
                red: CGFloat(colors.sky.0),
                green: CGFloat(colors.sky.1),
                blue: CGFloat(colors.sky.2),
                alpha: 1
            ))
        }

        let skyboxEntity = Entity()
        skyboxEntity.components.set(ModelComponent(mesh: mesh, materials: [material]))
        skyboxEntity.scale = .init(x: -1, y: 1, z: 1)
        skyboxEntity.name = "Skybox"
        return skyboxEntity
    }

    // MARK: - Preset Colors

    private struct SkyboxColors {
        let sky: (Float, Float, Float)
        let horizon: (Float, Float, Float)
        let ground: (Float, Float, Float)
    }

    private static func skyboxColors(for preset: String) -> SkyboxColors {
        switch preset {
        case "library":
            return SkyboxColors(
                sky: (0.15, 0.10, 0.08),    // dark warm brown
                horizon: (0.45, 0.30, 0.20), // amber
                ground: (0.25, 0.18, 0.12)   // dark wood
            )
        case "classroom":
            return SkyboxColors(
                sky: (0.55, 0.70, 0.90),     // light blue
                horizon: (0.85, 0.88, 0.92), // pale white-blue
                ground: (0.60, 0.58, 0.55)   // gray floor
            )
        case "museum":
            return SkyboxColors(
                sky: (0.20, 0.22, 0.28),     // dark slate
                horizon: (0.50, 0.52, 0.55), // cool gray
                ground: (0.30, 0.28, 0.25)   // marble dark
            )
        case "garden":
            return SkyboxColors(
                sky: (0.35, 0.55, 0.85),     // warm sky blue
                horizon: (0.85, 0.78, 0.55), // golden warm horizon
                ground: (0.22, 0.40, 0.15)   // rich grass green
            )
        case "temple":
            return SkyboxColors(
                sky: (0.12, 0.08, 0.15),     // deep purple
                horizon: (0.65, 0.45, 0.20), // gold
                ground: (0.20, 0.12, 0.08)   // dark stone
            )
        case "observatory":
            return SkyboxColors(
                sky: (0.02, 0.02, 0.10),     // near-black blue
                horizon: (0.08, 0.06, 0.20), // deep indigo
                ground: (0.10, 0.10, 0.12)   // dark platform
            )
        default:
            return SkyboxColors(
                sky: (0.30, 0.50, 0.80),     // default blue
                horizon: (0.70, 0.75, 0.80), // pale
                ground: (0.35, 0.30, 0.25)   // brown
            )
        }
    }

    // MARK: - Image Generation

    private static func createCGImage(pixels: [UInt8], width: Int, height: Int) -> CGImage? {
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let cfData = Data(pixels) as CFData
        guard let provider = CGDataProvider(data: cfData) else { return nil }
        return CGImage(
            width: width,
            height: height,
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider,
            decode: nil,
            shouldInterpolate: true,
            intent: .defaultIntent
        )
    }

    enum SkyboxError: LocalizedError {
        case imageNotFound(String)

        var errorDescription: String? {
            switch self {
            case .imageNotFound(let name):
                return "Skybox image '\(name)' not found in bundle."
            }
        }
    }
}
