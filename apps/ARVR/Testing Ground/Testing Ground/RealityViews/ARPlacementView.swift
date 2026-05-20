import SwiftUI
import RealityKit
import ARKit

/// AR mode immersive view — mixed reality with memory items placed in the real world.
struct ARPlacementView: View {

    @Environment(AppModel.self) private var appModel
    @State private var palaceVM = PalaceViewModel()
    @State private var selectedItem: PalaceItem?
    @State private var expandedItemId: String?
    /// Tracks which items are still loading their 3D models (for per-item spinners).
    @State private var loadingItemIds: Set<String> = []

    var body: some View {
        arRealityView
            .overlay(alignment: .top) { arOverlay }
            .gesture(tapGesture)
            .gesture(dragGesture)
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

    private var arRealityView: some View {
        RealityView { content in
            let root = Entity()
            root.name = "ARRoot"

            // Use a directional light so models are visible in AR passthrough
            let lightEntity = Entity()
            var light = DirectionalLightComponent()
            light.intensity = 1000
            lightEntity.components.set(light)
            lightEntity.orientation = simd_quatf(angle: -.pi / 3, axis: SIMD3<Float>(1, 0, 0))
            root.addChild(lightEntity)

            content.add(root)

        } update: { content in
            guard let root = content.entities.first(where: { $0.name == "ARRoot" }) else { return }
            updateRoot(root)
        }
    }

    private var arOverlay: some View {
        VStack(spacing: 12) {
            if let selectedItem {
                ItemInfoAttachment(
                    item: selectedItem,
                    isExpanded: Binding(
                        get: { expandedItemId == selectedItem.id },
                        set: { expanded in
                            if expanded {
                                expandedItemId = selectedItem.id
                            } else if expandedItemId == selectedItem.id {
                                expandedItemId = nil
                            }
                        }
                    ),
                    onTap: {
                        expandedItemId = selectedItem.id
                    },
                    onSave: { name, memoryText in
                        Task { await saveItemDetails(name: name, memoryText: memoryText, for: selectedItem) }
                    },
                    onReview: { quality in
                        Task {
                            await palaceVM.submitReview(itemId: selectedItem.id, quality: quality)
                            self.selectedItem = nil
                            expandedItemId = nil
                        }
                    },
                    onDelete: {
                        Task {
                            await palaceVM.removeItem(itemId: selectedItem.id)
                            self.selectedItem = nil
                            expandedItemId = nil
                        }
                    }
                )
                .transition(.opacity)
            }

            ForEach(loadingModelItems) { item in
                if loadingItemIds.contains(item.id) {
                    loadingBadge
                }
            }
        }
        .padding()
    }

    private var loadingModelItems: [PalaceItem] {
        palaceVM.items.filter { $0.displayType == "3d_model" && $0.assetId != nil }
    }

    private var loadingBadge: some View {
        HStack(spacing: 8) {
            ProgressView()
                .scaleEffect(0.7)
            Text("Loading...")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .glassBackground()
    }

    private var tapGesture: some Gesture {
        TapGesture()
            .targetedToAnyEntity()
            .onEnded { value in
                handleTap(on: value.entity)
            }
    }

    private var dragGesture: some Gesture {
        DragGesture()
            .targetedToAnyEntity()
            .onChanged { value in
                markDragging(value.entity, isSelected: true)
            }
            .onEnded { value in
                handleDragEnd(value.entity)
            }
    }

    private func updateRoot(_ root: Entity) {
        // Remove entities for items that were deleted so models disappear too.
        let liveItemIds = Set(palaceVM.items.map { $0.id })
        for child in root.children {
            guard let highlight = child.components[HighlightComponent.self] else { continue }
            if !liveItemIds.contains(highlight.itemId) {
                child.removeFromParent()
            }
        }

        for item in palaceVM.items {
            if root.findEntity(named: item.id) == nil {
                let entity = createItemEntity(item)
                root.addChild(entity)
            }
        }
    }

    private func handleTap(on entity: Entity) {
        guard let highlight = entity.components[HighlightComponent.self],
              let item = palaceVM.items.first(where: { $0.id == highlight.itemId }) else { return }

        selectedItem = item
        expandedItemId = item.id
    }

    private func handleDragEnd(_ entity: Entity) {
        guard let highlight = entity.components[HighlightComponent.self] else { return }
        let pos = entity.position
        Task {
            await palaceVM.updatePosition(itemId: highlight.itemId, x: pos.x, y: pos.y, z: pos.z)
            markDragging(entity, isSelected: false)
        }
    }

    private func markDragging(_ entity: Entity, isSelected: Bool) {
        guard let highlight = entity.components[HighlightComponent.self] else { return }
        entity.components.set(HighlightComponent(
            itemId: highlight.itemId,
            label: highlight.label,
            flashcardId: highlight.flashcardId,
            assetId: highlight.assetId,
            displayType: highlight.displayType,
            isSelected: isSelected
        ))
    }

    private func saveItemDetails(name: String, memoryText: String, for item: PalaceItem) async {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty, let palace = appModel.currentPalace else { return }

        do {
            _ = try await APIService.shared.updateItemMemoryText(
                palaceId: palace.id,
                itemId: item.id,
                customText: memoryText,
                label: trimmedName
            )
            await palaceVM.loadItems()
            appModel.palaceItemRefreshTrigger += 1
        } catch {
            palaceVM.errorMessage = error.localizedDescription
        }
    }

    private func createItemEntity(_ item: PalaceItem) -> Entity {
        let entity = Entity()
        entity.name = item.id
        entity.position = item.position

        // Flashcards: no visible model, just an invisible interaction collider.
        if item.flashcardId != nil {
            entity.components.set(CollisionComponent(shapes: [.generateBox(width: 0.12, height: 0.16, depth: 0.02)]))
            entity.components.set(InputTargetComponent())
            entity.components.set(HoverEffectComponent())
            entity.components.set(HighlightComponent(
                itemId: item.id,
                label: item.label,
                flashcardId: item.flashcardId,
                assetId: item.assetId,
                displayType: item.displayType
            ))
            entity.scale = SIMD3<Float>(repeating: item.scale)
            return entity
        }

        // Start with a loading placeholder sphere
        let placeholderMesh = MeshResource.generateSphere(radius: 0.06)
        var placeholderMat = PhysicallyBasedMaterial()
        placeholderMat.baseColor = .init(tint: .gray.withAlphaComponent(0.5))
        placeholderMat.roughness = .init(floatLiteral: 0.2)
        placeholderMat.metallic = .init(floatLiteral: 0.8)
        placeholderMat.emissiveColor = .init(color: .white)
        placeholderMat.emissiveIntensity = 0.4
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
                    let assetURL = try await AssetAPIService.shared.downloadAssetAsUSDZ(assetId: assetId)
                    let model = try await Entity(contentsOf: assetURL)

                    // Apply diffuse texture to fix black Polyhaven materials
                    await applyPolyhavenTexture(assetId: assetId, to: model)

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

    // MARK: - Texture Application

    @MainActor
    private func applyPolyhavenTexture(assetId: String, to entity: Entity) async {
        let cacheKey = "diff_\(assetId)_512.jpg"
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("AssetCache", isDirectory: true)
        let cachedFile = cacheDir.appendingPathComponent(cacheKey)

        var diffuseURL: URL? = nil

        if FileManager.default.fileExists(atPath: cachedFile.path) {
            diffuseURL = cachedFile
        } else {
            let urlStr = "\(BackendConfig.baseURL)/api/models/\(assetId)/thumbnail"
            if let url = URL(string: urlStr),
               let (tmp, _) = try? await URLSession.shared.download(from: url) {
                try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
                try? FileManager.default.moveItem(at: tmp, to: cachedFile)
                diffuseURL = cachedFile
            }
        }

        guard let diffuseURL,
              let texture = try? await TextureResource(contentsOf: diffuseURL) else {
            applyFallbackMaterial(to: entity)
            return
        }

        applyTextureRecursive(texture: texture, to: entity)
    }

    private func applyTextureRecursive(texture: TextureResource, to entity: Entity) {
        if var mc = entity.components[ModelComponent.self] {
            mc.materials = mc.materials.indices.map { _ in
                var mat = PhysicallyBasedMaterial()
                mat.baseColor = .init(tint: .white, texture: .init(texture))
                mat.roughness = .init(floatLiteral: 0.7)
                mat.metallic  = .init(floatLiteral: 0.0)
                return mat as any RealityKit.Material
            }
            entity.components.set(mc)
        }
        for child in entity.children { applyTextureRecursive(texture: texture, to: child) }
    }

    private func applyFallbackMaterial(to entity: Entity) {
        if var mc = entity.components[ModelComponent.self] {
            mc.materials = mc.materials.indices.map { _ in
                var mat = PhysicallyBasedMaterial()
                mat.baseColor = .init(tint: UIColor(white: 0.75, alpha: 1))
                mat.roughness = .init(floatLiteral: 0.7)
                mat.metallic  = .init(floatLiteral: 0.0)
                return mat as any RealityKit.Material
            }
            entity.components.set(mc)
        }
        for child in entity.children { applyFallbackMaterial(to: child) }
    }
}
