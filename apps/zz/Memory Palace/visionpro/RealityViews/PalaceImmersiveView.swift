import SwiftUI
import RealityKit
import RealityKitContent

/// VR mode immersive view — full skybox dome with placed memory items.
struct PalaceImmersiveView: View {

    @Environment(AppModel.self) private var appModel
    @State private var palaceVM = PalaceViewModel()
    @State private var selectedItem: PalaceItem?
    @State private var showReviewOverlay = false
    /// Tracks which items are still loading their 3D models (for per-item spinners).
    @State private var loadingItemIds: Set<String> = []

    // Live scene swap — palaceRoot is captured from the RealityView make closure
    @State private var palaceRoot: Entity? = nil

    /// Demo items shown when the palace has no real items yet.
    private static let demoItems: [(label: String, position: SIMD3<Float>, color: UIColor)] = [
        ("Photosynthesis",    SIMD3(-1.2, 1.4, -2.5), .systemGreen),
        ("Mitochondria",      SIMD3( 0.0, 1.8, -3.0), .systemBlue),
        ("Newton's Laws",     SIMD3( 1.2, 1.4, -2.5), .systemOrange),
        ("Water Cycle",       SIMD3(-0.8, 1.0, -2.0), .systemCyan),
        ("Pythagorean Thm",   SIMD3( 0.8, 1.0, -2.0), .systemPurple),
        ("DNA Structure",     SIMD3( 0.0, 1.2, -1.8), .systemRed),
    ]

    var body: some View {
        RealityView { content, attachments in
            let root = Entity()
            root.name = "PalaceRoot"
            content.add(root)
            palaceRoot = root

            // 1. Load environment
            if let palace = appModel.currentPalace {
                await loadSkybox(for: palace, into: root)
            } else {
                await loadDefaultDome(into: root)
            }

            // 2. IBL lighting
            try? await root.applyImageBasedLighting()

        } update: { content, attachments in
            guard let root = content.entities.first(where: { $0.name == "PalaceRoot" }) else { return }

            // Remove model entities for items that no longer exist (deleted items).
            // Without this the SwiftUI attachment disappears but the 3D model lingers.
            // We identify our item entities by HighlightComponent so we don't accidentally
            // touch the skybox, demo entities, or RealityView attachment entities.
            let liveItemIds = Set(palaceVM.items.map { $0.id })
            for child in root.children {
                guard let highlight = child.components[HighlightComponent.self] else { continue }
                if !liveItemIds.contains(highlight.itemId) {
                    child.removeFromParent()
                }
            }

            // Add/update real items when they arrive from the API
            if !palaceVM.items.isEmpty {
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
            } else if appModel.currentPalace != nil {
                if root.findEntity(named: "demo_entity_0") == nil {
                    addDemoEntities(to: root, attachments: attachments)
                }
            }
        } attachments: {
            // Attachments for real items
            ForEach(palaceVM.items) { item in
                Attachment(id: item.id) {
                    ItemInfoAttachment(
                        item: item,
                        onTap: { selectItem(item) },
                        onReview: { quality in
                            Task {
                                await palaceVM.submitReview(itemId: item.id, quality: quality)
                                showReviewOverlay = false
                                selectedItem = nil
                            }
                        },
                        onDelete: {
                            Task { await palaceVM.removeItem(itemId: item.id) }
                        }
                    )
                    .id("\(item.id)-\(item.nextReviewAt?.timeIntervalSince1970 ?? 0)")
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
                                .foregroundStyle(.black)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color.white.opacity(0.95))
                        .clipShape(Capsule())
                    }
                }
            }

            // Attachments for demo items
            if palaceVM.items.isEmpty && appModel.currentPalace != nil {
                ForEach(0..<Self.demoItems.count, id: \.self) { idx in
                    Attachment(id: "demo_\(idx)") {
                        demoLabel(Self.demoItems[idx].label)
                    }
                }
            }
        }
        .gesture(
            TapGesture()
                .targetedToAnyEntity()
                .onEnded { value in
                    handleTap(on: value.entity)
                }
        )
        .gesture(
            DragGesture()
                .targetedToAnyEntity()
                .onChanged { value in
                    handleDrag(entity: value.entity, translation: value.translation3D)
                }
                .onEnded { value in
                    handleDragEnd(entity: value.entity)
                }
        )
        .task {
            if let palace = appModel.currentPalace {
                palaceVM.currentPalace = palace
            }
            await palaceVM.loadItems()
        }
        .onChange(of: appModel.activeSceneURL) { _, newURL in
            Task { await swapSkybox(urlString: newURL, preset: appModel.activeScenePreset) }
        }
        .onChange(of: appModel.activeScenePreset) { _, newPreset in
            // Only swap when there is no HDRI override (preset-only change)
            guard appModel.activeSceneURL == nil else { return }
            Task { await swapSkybox(urlString: nil, preset: newPreset) }
        }
    }

    // MARK: - Live Skybox Swap

    @MainActor
    private func swapSkybox(urlString: String?, preset: String?) async {
        guard let root = palaceRoot else { return }

        // Remove old skybox
        root.findEntity(named: "PalaceSkybox")?.removeFromParent()

        // Build new skybox
        let newSkybox: Entity
        if let urlStr = urlString, let url = URL(string: urlStr) {
            newSkybox = (try? await Entity.createSkybox(from: url))
                ?? Entity.createProceduralSkybox(preset: preset ?? "library")
        } else {
            newSkybox = (try? await Entity.createSkybox(named: preset ?? "library"))
                ?? Entity.createProceduralSkybox(preset: preset ?? "library")
        }
        newSkybox.name = "PalaceSkybox"
        root.addChild(newSkybox)
    }

    // MARK: - Environment Loading

    private func loadDefaultDome(into root: Entity) async {
        if let immersiveScene = try? await Entity(named: "Immersive", in: realityKitContentBundle) {
            if let videoDock = immersiveScene.findEntity(named: "Video_Dock") {
                videoDock.removeFromParent()
            }
            root.addChild(immersiveScene)
        } else {
            let skybox = Entity.createProceduralSkybox(preset: "library")
            root.addChild(skybox)
        }
    }

    private func loadSkybox(for palace: MemoryPalace, into root: Entity) async {
        let skybox: Entity
        switch palace.skyboxType {
        case "uploaded", "ai_generated":
            if let path = palace.skyboxImagePath {
                // Full URLs (e.g. Polyhaven HDRI) are used directly;
                // relative paths are resolved against the media server.
                let urlStr = path.hasPrefix("http") ? path : "\(BackendConfig.mediaURL)/\(path)"
                if let url = URL(string: urlStr) {
                    skybox = (try? await Entity.createSkybox(from: url))
                        ?? Entity.createProceduralSkybox(preset: palace.skyboxPreset ?? "library")
                } else {
                    skybox = Entity.createProceduralSkybox(preset: palace.skyboxPreset ?? "library")
                }
            } else {
                skybox = (try? await Entity.createSkybox(named: palace.skyboxPreset ?? "library"))
                    ?? Entity.createProceduralSkybox(preset: palace.skyboxPreset ?? "library")
            }
        default:
            skybox = (try? await Entity.createSkybox(named: palace.skyboxPreset ?? "library"))
                ?? Entity.createProceduralSkybox(preset: palace.skyboxPreset ?? "library")
        }
        skybox.name = "PalaceSkybox"
        root.addChild(skybox)
    }

    // MARK: - Demo Label

    private func demoLabel(_ text: String) -> some View {
        Text(text)
            .font(.body)
            .fontWeight(.semibold)
            .foregroundStyle(.black)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color.white.opacity(0.95))
            .clipShape(Capsule())
    }

    // MARK: - Demo Entities

    private func addDemoEntities(to root: Entity, attachments: RealityViewAttachments) {
        for (idx, demo) in Self.demoItems.enumerated() {
            let entity = Entity()
            entity.name = "demo_entity_\(idx)"
            entity.position = demo.position

            let mesh = MeshResource.generateBox(width: 0.18, height: 0.24, depth: 0.008, cornerRadius: 0.01)
            var mat = PhysicallyBasedMaterial()
            mat.baseColor = .init(tint: demo.color)
            mat.roughness = .init(floatLiteral: 0.3)
            mat.metallic = .init(floatLiteral: 0.1)
            entity.components.set(ModelComponent(mesh: mesh, materials: [mat]))

            entity.components.set(CollisionComponent(shapes: [.generateBox(width: 0.18, height: 0.24, depth: 0.008)]))
            entity.components.set(InputTargetComponent())
            entity.components.set(HoverEffectComponent())

            let lookDir = -normalize(demo.position)
            let angle = atan2(lookDir.x, lookDir.z)
            entity.orientation = simd_quatf(angle: angle, axis: SIMD3<Float>(0, 1, 0))

            root.addChild(entity)

            if let attachment = attachments.entity(for: "demo_\(idx)") {
                attachment.position = demo.position + SIMD3<Float>(0, 0.16, 0)
                root.addChild(attachment)
            }
        }
    }

    // MARK: - Item Entities

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
                    // Download model + textures
                    let asset = try await ModelDownloader.shared.download(assetId: assetId)
                    let model = try Entity.load(contentsOf: asset.modelURL)

                    // Apply real PBR materials (Polyhaven uses MaterialX which RealityKit can't parse)
                    Self.applyTextures(to: model, diffuseURL: asset.diffuseURL, roughnessURL: asset.roughnessURL)

                    // Auto-scale to fit within ~0.3m
                    let bounds = model.visualBounds(relativeTo: nil)
                    let maxDim = max(bounds.extents.x, max(bounds.extents.y, bounds.extents.z))
                    if maxDim > 0.001 {
                        model.scale *= 0.3 / maxDim
                    }

                    // Replace placeholder with loaded model
                    entity.components.remove(ModelComponent.self)
                    entity.addChild(model)

                    // Update collision to match actual model
                    let newBounds = entity.visualBounds(relativeTo: nil)
                    if newBounds.extents.x > 0 {
                        entity.components.set(CollisionComponent(shapes: [.generateBox(size: newBounds.extents)]))
                    }
                } catch {
                    print("Failed to load 3D model \(assetId): \(error)")
                }
            }
        } else {
            // Non-3D items: card or text panel
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

    /// Replace all materials on entity tree with PhysicallyBasedMaterial using downloaded textures.
    /// Polyhaven USDC files use MaterialX shaders which RealityKit can't parse — models load
    /// with correct geometry but black materials. This function applies real PBR textures.
    @MainActor
    private static func applyTextures(to entity: Entity, diffuseURL: URL?, roughnessURL: URL?) {
        // Load textures from local cache files (already downloaded by ModelDownloader)
        let diffuseTex: TextureResource? = {
            guard let url = diffuseURL else { return nil }
            return try? TextureResource.load(contentsOf: url)
        }()
        let roughnessTex: TextureResource? = {
            guard let url = roughnessURL else { return nil }
            return try? TextureResource.load(contentsOf: url)
        }()

        applyMaterialsRecursive(to: entity, diffuse: diffuseTex, roughness: roughnessTex)
    }

    private static func applyMaterialsRecursive(to entity: Entity, diffuse: TextureResource?, roughness: TextureResource?) {
        if var mc = entity.components[ModelComponent.self] {
            mc.materials = mc.materials.enumerated().map { index, _ in
                var mat = PhysicallyBasedMaterial()
                if let diffuse {
                    // Bright white tint lets the full texture color through
                    mat.baseColor = .init(tint: .white, texture: .init(diffuse))
                } else {
                    // No diffuse texture — use a warm, visible tone
                    let brightness: CGFloat = 0.85 + CGFloat(index % 3) * 0.05
                    mat.baseColor = .init(tint: UIColor(white: brightness, alpha: 1.0))
                }
                if let roughness {
                    mat.roughness = .init(texture: .init(roughness))
                } else {
                    mat.roughness = .init(floatLiteral: 0.6)
                }
                mat.metallic = .init(floatLiteral: 0.0)
                // Boost brightness with a subtle emissive so models aren't dark in dim environments
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

    // MARK: - Interactions

    private func selectItem(_ item: PalaceItem) {
        selectedItem = item
        showReviewOverlay = true
    }

    private func handleTap(on entity: Entity) {
        guard let highlight = entity.components[HighlightComponent.self] else { return }
        if let item = palaceVM.items.first(where: { $0.id == highlight.itemId }) {
            selectItem(item)
        }
    }

    @State private var dragStartPosition: SIMD3<Float>?

    private func handleDrag(entity: Entity, translation: Vector3D) {
        if dragStartPosition == nil {
            dragStartPosition = entity.position
        }
        let t = SIMD3<Float>(Float(translation.x), Float(translation.y), Float(translation.z)) * 0.001
        entity.position = (dragStartPosition ?? .zero) + t
    }

    private func handleDragEnd(entity: Entity) {
        guard let highlight = entity.components[HighlightComponent.self] else { return }
        let pos = entity.position
        Task {
            await palaceVM.updatePosition(itemId: highlight.itemId, x: pos.x, y: pos.y, z: pos.z)
        }
        dragStartPosition = nil
    }
}
