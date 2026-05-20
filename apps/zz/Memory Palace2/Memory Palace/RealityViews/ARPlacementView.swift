import SwiftUI
import RealityKit
import ARKit

/// AR mode immersive view — mixed reality with memory items placed in the real world.
struct ARPlacementView: View {

    @Environment(AppModel.self) private var appModel
    @State private var palaceVM = PalaceViewModel()
    @State private var selectedItem: PalaceItem?
    /// Tracks which items are still loading their 3D models (for per-item spinners).
    @State private var loadingItemIds: Set<String> = []

    var body: some View {
        RealityView { content, attachments in
            let root = Entity()
            root.name = "ARRoot"
            content.add(root)
            _ = attachments

        } update: { content, attachments in
            guard let root = content.entities.first(where: { $0.name == "ARRoot" }) else { return }

            for item in palaceVM.items {
                if root.findEntity(named: item.id) == nil {
                    let entity = createItemEntity(item)
                    root.addChild(entity)
                }
                // Position label attachment above item
                if let attachment = attachments.entity(for: item.id) {
                    attachment.position = item.position + SIMD3<Float>(0, 0.25, 0)
                    if attachment.parent == nil {
                        root.addChild(attachment)
                    }
                }
                // Position per-item loading spinner
                if let spinner = attachments.entity(for: "loading_\(item.id)") {
                    spinner.position = item.position + SIMD3<Float>(0, 0.40, 0)
                    if spinner.parent == nil {
                        root.addChild(spinner)
                    }
                }
            }
        } attachments: {
            ForEach(palaceVM.items) { item in
                Attachment(id: item.id) {
                    ItemInfoAttachment(
                        item: item,
                        onTap: { selectedItem = item },
                        onReview: { quality in
                            Task {
                                await palaceVM.submitReview(itemId: item.id, quality: quality)
                                selectedItem = nil
                            }
                        }
                    )
                }
            }

            // Per-item loading spinners (always created for 3D items, visibility controlled by state)
            ForEach(palaceVM.items.filter { $0.displayType == "3d_model" && $0.assetId != nil }) { item in
                Attachment(id: "loading_\(item.id)") {
                    if loadingItemIds.contains(item.id) {
                        HStack(spacing: 8) {
                            ProgressView()
                                .scaleEffect(0.7)
                            Text("Loading…")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .glassBackgroundEffect()
                    }
                }
            }
        }
        .gesture(
            TapGesture()
                .targetedToAnyEntity()
                .onEnded { value in
                    if let highlight = value.entity.components[HighlightComponent.self],
                       let item = palaceVM.items.first(where: { $0.id == highlight.itemId }) {
                        selectedItem = item
                    }
                }
        )
        .gesture(
            DragGesture()
                .targetedToAnyEntity()
                .onChanged { value in
                    value.entity.position = value.convert(value.location3D, from: .local, to: value.entity.parent!)
                }
                .onEnded { value in
                    guard let highlight = value.entity.components[HighlightComponent.self] else { return }
                    let pos = value.entity.position
                    Task {
                        await palaceVM.updatePosition(itemId: highlight.itemId, x: pos.x, y: pos.y, z: pos.z)
                    }
                }
        )
        .task {
            if let palace = appModel.currentPalace {
                palaceVM.currentPalace = palace
            }
            await palaceVM.loadItems()
        }
        .onChange(of: appModel.palaceItemRefreshTrigger) { _, _ in
            Task {
                if let palace = appModel.currentPalace {
                    palaceVM.currentPalace = palace
                }
                await palaceVM.loadItems()
            }
        }
    }

    private func createItemEntity(_ item: PalaceItem) -> Entity {
        let entity = Entity()
        entity.name = item.id
        entity.position = item.position

        // Start with a loading placeholder sphere
        let placeholderMesh = MeshResource.generateSphere(radius: 0.06)
        var placeholderMat = PhysicallyBasedMaterial()
        placeholderMat.baseColor = .init(tint: .gray.withAlphaComponent(0.5))
        placeholderMat.roughness = .init(floatLiteral: 0.2)
        placeholderMat.metallic = .init(floatLiteral: 0.8)
        entity.components.set(ModelComponent(mesh: placeholderMesh, materials: [placeholderMat]))

        entity.components.set(CollisionComponent(shapes: [.generateSphere(radius: 0.06)]))
        entity.components.set(InputTargetComponent())
        entity.components.set(HoverEffectComponent())
        entity.components.set(HighlightComponent(
            itemId: item.id,
            label: item.label,
            flashcardId: item.flashcardId,
            assetId: item.assetId,
            displayType: item.displayType
        ))

        entity.orientation = simd_quatf(angle: item.rotationY * .pi / 180, axis: SIMD3<Float>(0, 1, 0))

        // Load the actual 3D model asynchronously
        if item.displayType == "3d_model", let assetId = item.assetId {
            let itemId = item.id
            Task {
                loadingItemIds.insert(itemId)
                defer { loadingItemIds.remove(itemId) }
                do {
                    let assetURL = try await AssetAPIService.shared.downloadAssetWithTextures(assetId: assetId)
                    let model = try await Entity(contentsOf: assetURL)

                    // Materials are handled via downloadAssetWithTextures directory struct
                    Self.applyDownloadedTextures(to: model, from: assetURL)

                    let bounds = model.visualBounds(relativeTo: nil)
                    let maxDim = max(bounds.extents.x, max(bounds.extents.y, bounds.extents.z))
                    if maxDim > 0.001 {
                        model.scale *= 0.3 / maxDim
                    }

                    entity.components.remove(ModelComponent.self)
                    entity.addChild(model)

                    let newBounds = entity.visualBounds(relativeTo: nil)
                    if newBounds.extents.x > 0 {
                        entity.components.set(CollisionComponent(shapes: [.generateBox(size: newBounds.extents)]))
                    }
                } catch {
                    print("Failed to load 3D model \(assetId): \(error)")
                }
            }
        } else {
            let mesh: MeshResource
            let material: any RealityKit.Material
            switch item.displayType {
            case "text_panel":
                mesh = MeshResource.generatePlane(width: 0.3, height: 0.2)
                var mat = UnlitMaterial()
                mat.color = .init(tint: .white.withAlphaComponent(0.9))
                material = mat
            default:
                mesh = MeshResource.generateBox(width: 0.15, height: 0.2, depth: 0.005)
                var mat = PhysicallyBasedMaterial()
                mat.baseColor = .init(tint: .white)
                material = mat
            }
            entity.components.set(ModelComponent(mesh: mesh, materials: [material]))
            let bounds = entity.visualBounds(relativeTo: nil)
            entity.components.set(CollisionComponent(shapes: [.generateBox(size: bounds.extents)]))
        }

        entity.scale = SIMD3<Float>(repeating: item.scale)

        return entity
    }

    // MARK: - Material Fix (Polyhaven MaterialX → RealityKit PBR)

    @MainActor
    private static func applyDownloadedTextures(to entity: Entity, from assetURL: URL) {
        let parentDir = assetURL.deletingLastPathComponent()
        let texturesDir = parentDir.appendingPathComponent("textures")
        
        var diffuseURL: URL? = nil
        var roughnessURL: URL? = nil
        
        let fm = FileManager.default
        if let files = try? fm.contentsOfDirectory(at: texturesDir, includingPropertiesForKeys: nil) {
            diffuseURL = files.first { $0.lastPathComponent.contains("diff") || $0.lastPathComponent.contains("color") }
            roughnessURL = files.first { $0.lastPathComponent.contains("rough") }
        }

        let diffuseTex = diffuseURL.flatMap { try? TextureResource.load(contentsOf: $0) }
        let roughnessTex = roughnessURL.flatMap { try? TextureResource.load(contentsOf: $0) }

        applyMaterialsRecursive(to: entity, diffuse: diffuseTex, roughness: roughnessTex)
    }

    private static func applyMaterialsRecursive(to entity: Entity, diffuse: TextureResource?, roughness: TextureResource?) {
        if var mc = entity.components[ModelComponent.self] {
            mc.materials = mc.materials.enumerated().map { index, _ in
                var mat = PhysicallyBasedMaterial()
                if let diffuse {
                    mat.baseColor = .init(tint: .white, texture: .init(diffuse))
                } else {
                    let brightness: CGFloat = 0.85 + CGFloat(index % 3) * 0.05
                    mat.baseColor = .init(tint: UIColor(white: brightness, alpha: 1.0))
                }
                if let roughness {
                    mat.roughness = .init(texture: .init(roughness))
                } else {
                    mat.roughness = .init(floatLiteral: 0.6)
                }
                mat.metallic = .init(floatLiteral: 0.0)
                mat.emissiveColor = .init(color: UIColor(white: 0.15, alpha: 1.0))
                mat.emissiveIntensity = 0.3
                return mat as any RealityKit.Material
            }
            entity.components.set(mc)
        }
        for child in entity.children {
            applyMaterialsRecursive(to: child, diffuse: diffuse, roughness: roughness)
        }
    }
}
