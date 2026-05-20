import SwiftUI
import RealityKit
import RealityKitContent
import ARKit
import QuartzCore

#if os(visionOS)
/// VR mode immersive view — full skybox dome with placed memory items.
struct PalaceImmersiveView: View {

    @Environment(AppModel.self) private var appModel
    @Environment(\.openWindow) private var openWindow
    @State private var palaceVM = PalaceViewModel()
    @State private var selectedItem: PalaceItem?
    @State private var showReviewOverlay = false
    @State private var loadingItemIds: Set<String> = []
    @State private var palaceRoot: Entity? = nil
    @State private var memoryTargetItem: PalaceItem? = nil
    @State private var memorySaveError: String? = nil
    @State private var expandedItemId: String? = nil
    @State private var arkitSession = ARKitSession()
    @State private var worldTrackingProvider = WorldTrackingProvider()
    @State private var initialDevicePosition: SIMD3<Float>? = nil
    @State private var isHDRISceneMotionEnabled = false
    @State private var groundedItemIds: Set<String> = []
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
            updateBuiltInEnvironment(in: root, preset: initialBuiltInPreset)

            // 2. IBL lighting
            try? await root.applyImageBasedLighting()

        } update: { content, attachments in
            guard let root = content.entities.first(where: { $0.name == "PalaceRoot" }) else { return }

            // Remove entities for items that were deleted so models disappear too.
            let liveItemIds = Set(palaceVM.items.map { $0.id })
            groundedItemIds = groundedItemIds.intersection(liveItemIds)
            for child in root.children {
                guard let highlight = child.components[HighlightComponent.self] else { continue }
                if !liveItemIds.contains(highlight.itemId) {
                    child.removeFromParent()
                }
            }

            // Add/update real items when they arrive from the API
            if !palaceVM.items.isEmpty {
                for item in palaceVM.items {
                    let entity: Entity
                    if let existing = root.findEntity(named: item.id) {
                        entity = existing
                        if !groundedItemIds.contains(item.id) {
                            updateDisplayPosition(for: entity, item: item)
                            groundedItemIds.insert(item.id)
                        }
                    } else {
                        entity = createItemEntity(item)
                        groundedItemIds.insert(item.id)
                        root.addChild(entity)
                    }

                    // Issue 17: position label attachment above item without overlapping —
                    // attach it to the entity so it follows when the item moves
                    if let attachment = attachments.entity(for: item.id) {
                        attachment.position = attachmentPosition(for: entity, isExpanded: expandedItemId == item.id)
                        if attachment.parent !== entity {
                            attachment.removeFromParent()
                            entity.addChild(attachment)
                        }
                    }
                    // Position per-item loading spinner
                    if let spinner = attachments.entity(for: "loading_\(item.id)") {
                        spinner.position = SIMD3<Float>(0, 0.40, 0)
                        if spinner.parent !== entity {
                            spinner.removeFromParent()
                            entity.addChild(spinner)
                        }
                    }
                }
            }

            // Memory note panel — beside the item at eye level
            if let notePanel = attachments.entity(for: "memory_note_panel"),
               let noteItem = memoryTargetItem {
                notePanel.position = noteItem.position + SIMD3<Float>(0.45, 0.1, 0.15)
                if notePanel.parent == nil {
                    root.addChild(notePanel)
                }
            }
        } attachments: {
            // Attachments for real items
            ForEach(palaceVM.items) { item in
                Attachment(id: item.id) {
                    ItemInfoAttachment(
                        item: item,
                        isExpanded: Binding(
                            get: { expandedItemId == item.id },
                            set: { expanded in
                                if expanded {
                                    expandedItemId = item.id
                                } else if expandedItemId == item.id {
                                    expandedItemId = nil
                                }
                            }
                        ),
                        aiContextText: aiContext(for: item),
                        onTap: { selectItem(item) },
                        onSave: { name, memoryText in
                            Task { await saveItemDetails(name: name, memoryText: memoryText, for: item) }
                        },
                        onReview: { quality in
                            Task {
                                await palaceVM.submitReview(itemId: item.id, quality: quality)
                                expandedItemId = nil
                                selectedItem = nil
                            }
                        },
                        onDelete: {
                            Task {
                                let removed = await palaceVM.removeItem(itemId: item.id)
                                if removed {
                                    if expandedItemId == item.id { expandedItemId = nil }
                                    appModel.palaceItemRefreshTrigger += 1
                                }
                            }
                        }
                    )
                }
            }

            if let noteItem = memoryTargetItem {
                Attachment(id: "memory_note_panel") {
                    MemoryNotePanel(
                        item: noteItem,
                        errorMessage: memorySaveError,
                        onSave: { note in
                            Task {
                                await saveMemoryNote(note, for: noteItem)
                            }
                        },
                        onClose: {
                            memorySaveError = nil
                            memoryTargetItem = nil
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
                        .glassBackground()
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
                    handleDrag(value)
                }
                .onEnded { value in
                    handleDragEnd(value.entity)
                }
        )
        .task {
            if let palace = appModel.currentPalace {
                palaceVM.currentPalace = palace
            }
            await palaceVM.loadItems()
        }
        .task {
            await startSceneMotionTracking()
        }
        .onChange(of: appModel.palaceItemRefreshTrigger) { _, _ in
            Task { await palaceVM.loadItems() }
        }
        .onChange(of: appModel.activeSceneURL) { _, newURL in
            Task { await swapSkybox(urlString: newURL, preset: appModel.activeScenePreset) }
        }
        .onChange(of: appModel.activeScenePreset) { _, newPreset in
            guard appModel.activeSceneURL == nil else { return }
            Task { await swapSkybox(urlString: nil, preset: newPreset) }
        }
        .alert("Error", isPresented: .init(
            get: { palaceVM.errorMessage != nil },
            set: { if !$0 { palaceVM.errorMessage = nil } }
        )) {
            Button("OK") { palaceVM.errorMessage = nil }
        } message: {
            Text(palaceVM.errorMessage ?? "")
        }
    }

    // MARK: - Live Skybox Swap

    private var initialBuiltInPreset: String? {
        if let palace = appModel.currentPalace {
            return palace.skyboxType == "preset" ? (palace.skyboxPreset ?? "library") : nil
        }
        return appModel.activeSceneURL == nil ? appModel.activeScenePreset : nil
    }

    @MainActor
    private func swapSkybox(urlString: String?, preset: String?) async {
        guard let root = palaceRoot else { return }
        isHDRISceneMotionEnabled = urlString != nil
        initialDevicePosition = nil

        // Build the new skybox before removing the old one so there is no gap frame (#13).
        let newSkybox: Entity
        if let urlStr = urlString, let url = URL(string: urlStr) {
            newSkybox = (try? await Entity.createSkybox(from: url, radius: Self.hdriSkyboxRadius))
                ?? Entity.createProceduralSkybox(preset: preset ?? "library")
        } else {
            newSkybox = (try? await Entity.createSkybox(named: preset ?? "library"))
                ?? Entity.createProceduralSkybox(preset: preset ?? "library")
        }
        newSkybox.name = "PalaceSkybox"
        root.findEntity(named: "PalaceSkybox")?.removeFromParent()
        root.addChild(newSkybox)
        updateBuiltInEnvironment(in: root, preset: urlString == nil ? preset : nil)
    }

    // MARK: - Environment Loading

    private func loadDefaultDome(into root: Entity) async {
        isHDRISceneMotionEnabled = false
        if let immersiveScene = try? await Entity(named: "Immersive", in: realityKitContentBundle) {
            if let videoDock = immersiveScene.findEntity(named: "Video_Dock") {
                videoDock.removeFromParent()
            }
            immersiveScene.name = "PalaceSkybox"
            root.addChild(immersiveScene)
        } else {
            let skybox = Entity.createProceduralSkybox(preset: "library")
            skybox.name = "PalaceSkybox"
            root.addChild(skybox)
        }
    }

    private func loadSkybox(for palace: MemoryPalace, into root: Entity) async {
        isHDRISceneMotionEnabled = false
        let skybox: Entity
        switch palace.skyboxType {
        case "uploaded", "ai_generated":
            if let path = palace.skyboxImagePath,
               let url = skyboxURL(from: path) {
                let usesRemoteHDRI = path.hasPrefix("http://") || path.hasPrefix("https://")
                isHDRISceneMotionEnabled = usesRemoteHDRI
                let radius = usesRemoteHDRI ? Self.hdriSkyboxRadius : 1000
                let skyboxURL = usesRemoteHDRI
                    ? ((try? await HDRISceneCache.downloadIfNeeded(remoteURLString: path)) ?? url)
                    : url
                skybox = (try? await Entity.createSkybox(from: skyboxURL, radius: radius))
                    ?? Entity.createProceduralSkybox(preset: palace.skyboxPreset ?? "library")
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
        updateBuiltInEnvironment(in: root, preset: palace.skyboxType == "preset" ? (palace.skyboxPreset ?? "library") : nil)
    }

    private func skyboxURL(from path: String) -> URL? {
        if path.hasPrefix("http://") || path.hasPrefix("https://") || path.hasPrefix("file://") {
            return URL(string: path)
        }

        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        return URL(string: "\(BackendConfig.baseURL)/\(normalizedPath)")
    }

    // MARK: - Built-In Scene Props

    private func updateBuiltInEnvironment(in root: Entity, preset: String?) {
        root.findEntity(named: "BuiltInSceneEnvironment")?.removeFromParent()
        guard let preset else { return }

        let environment = Entity()
        environment.name = "BuiltInSceneEnvironment"

        switch preset {
        case "garden":
            addGround(to: environment, color: UIColor(red: 0.18, green: 0.34, blue: 0.14, alpha: 1), width: 7.5, depth: 7.5)
            addPath(to: environment)
            addTreeLine(to: environment)
            addLowBlocks(to: environment, color: UIColor(red: 0.30, green: 0.42, blue: 0.18, alpha: 1), z: -3.4, count: 5)
        case "classroom":
            addGround(to: environment, color: UIColor(red: 0.42, green: 0.39, blue: 0.34, alpha: 1), width: 7.0, depth: 7.0)
            addBackWall(to: environment, color: UIColor(red: 0.74, green: 0.72, blue: 0.66, alpha: 1))
            addBoard(to: environment)
            addDeskRows(to: environment)
        case "museum":
            addGround(to: environment, color: UIColor(red: 0.36, green: 0.35, blue: 0.33, alpha: 1), width: 7.5, depth: 7.5)
            addBackWall(to: environment, color: UIColor(red: 0.55, green: 0.54, blue: 0.50, alpha: 1))
            addColumns(to: environment)
            addDisplayPlinths(to: environment)
        case "temple":
            addGround(to: environment, color: UIColor(red: 0.28, green: 0.22, blue: 0.18, alpha: 1), width: 7.5, depth: 7.5)
            addBackWall(to: environment, color: UIColor(red: 0.34, green: 0.24, blue: 0.16, alpha: 1))
            addColumns(to: environment, color: UIColor(red: 0.65, green: 0.48, blue: 0.25, alpha: 1))
            addLowBlocks(to: environment, color: UIColor(red: 0.45, green: 0.30, blue: 0.16, alpha: 1), z: -3.2, count: 3)
        case "observatory":
            addGround(to: environment, color: UIColor(red: 0.08, green: 0.09, blue: 0.13, alpha: 1), width: 7.5, depth: 7.5)
            addBackWall(to: environment, color: UIColor(red: 0.06, green: 0.07, blue: 0.12, alpha: 1))
            addTelescope(to: environment)
            addStarMarkers(to: environment)
        default:
            addGround(to: environment, color: UIColor(red: 0.26, green: 0.18, blue: 0.12, alpha: 1), width: 7.5, depth: 7.5)
            addBackWall(to: environment, color: UIColor(red: 0.30, green: 0.20, blue: 0.14, alpha: 1))
            addShelves(to: environment)
            addReadingTables(to: environment)
        }

        root.addChild(environment)
    }

    private func startSceneMotionTracking() async {
        guard WorldTrackingProvider.isSupported else { return }

        do {
            try await arkitSession.run([worldTrackingProvider])
        } catch {
            print("Scene motion tracking unavailable: \(error)")
            return
        }

        while !Task.isCancelled {
            updateSceneMotion()
            try? await Task.sleep(nanoseconds: 33_000_000)
        }
    }

    @MainActor
    private func updateSceneMotion() {
        guard isHDRISceneMotionEnabled,
              let root = palaceRoot,
              worldTrackingProvider.state == .running,
              let deviceAnchor = worldTrackingProvider.queryDeviceAnchor(atTimestamp: CACurrentMediaTime()) else {
            return
        }

        let transform = deviceAnchor.originFromAnchorTransform
        let currentPosition = SIMD3<Float>(
            transform.columns.3.x,
            transform.columns.3.y,
            transform.columns.3.z
        )

        if initialDevicePosition == nil {
            initialDevicePosition = currentPosition
        }

        guard let initialDevicePosition else { return }
        let delta = currentPosition - initialDevicePosition
        let horizontalDelta = SIMD3<Float>(delta.x, 0, delta.z)

        if let skybox = root.findEntity(named: "PalaceSkybox") {
            skybox.position = clampedOffset(
                -horizontalDelta * Self.skyboxMovementMultiplier,
                maxLength: Self.maxSkyboxOffset
            )
        }
    }

    private func clampedOffset(_ offset: SIMD3<Float>, maxLength: Float) -> SIMD3<Float> {
        let length = simd_length(offset)
        guard length > maxLength, length > 0.001 else { return offset }
        return offset / length * maxLength
    }

    private func makeMaterial(_ color: UIColor, roughness: Float = 0.75) -> PhysicallyBasedMaterial {
        var material = PhysicallyBasedMaterial()
        material.baseColor = .init(tint: color)
        material.roughness = .init(floatLiteral: roughness)
        material.metallic = .init(floatLiteral: 0)
        return material
    }

    private func addBox(
        to root: Entity,
        name: String = "SceneProp",
        position: SIMD3<Float>,
        size: SIMD3<Float>,
        color: UIColor,
        roughness: Float = 0.75
    ) {
        let entity = Entity()
        entity.name = name
        entity.position = position
        entity.components.set(ModelComponent(
            mesh: .generateBox(width: size.x, height: size.y, depth: size.z),
            materials: [makeMaterial(color, roughness: roughness)]
        ))
        root.addChild(entity)
    }

    private func addGround(to root: Entity, color: UIColor, width: Float, depth: Float) {
        addBox(
            to: root,
            name: "SceneGround",
            position: SIMD3<Float>(0, -0.55, -1.45),
            size: SIMD3<Float>(width, 0.03, depth),
            color: color
        )
    }

    private func addBackWall(to root: Entity, color: UIColor) {
        addBox(
            to: root,
            name: "SceneBackWall",
            position: SIMD3<Float>(0, 0.55, -4.2),
            size: SIMD3<Float>(7.5, 2.1, 0.06),
            color: color
        )
    }

    private func addPath(to root: Entity) {
        addBox(
            to: root,
            name: "GardenPath",
            position: SIMD3<Float>(0, -0.52, -1.65),
            size: SIMD3<Float>(1.25, 0.025, 5.2),
            color: UIColor(red: 0.52, green: 0.46, blue: 0.36, alpha: 1)
        )
    }

    private func addTreeLine(to root: Entity) {
        for index in 0..<7 {
            let x = Float(index - 3) * 1.05
            addBox(
                to: root,
                name: "TreeTrunk",
                position: SIMD3<Float>(x, -0.05, -3.65),
                size: SIMD3<Float>(0.10, 0.9, 0.10),
                color: UIColor(red: 0.25, green: 0.14, blue: 0.07, alpha: 1)
            )
            addBox(
                to: root,
                name: "TreeCanopy",
                position: SIMD3<Float>(x, 0.45, -3.65),
                size: SIMD3<Float>(0.62, 0.62, 0.24),
                color: UIColor(red: 0.09, green: 0.26, blue: 0.10, alpha: 1)
            )
        }
    }

    private func addBoard(to root: Entity) {
        addBox(
            to: root,
            name: "ClassroomBoard",
            position: SIMD3<Float>(0, 0.75, -4.12),
            size: SIMD3<Float>(2.8, 0.95, 0.04),
            color: UIColor(red: 0.05, green: 0.23, blue: 0.16, alpha: 1)
        )
    }

    private func addDeskRows(to root: Entity) {
        for row in 0..<2 {
            for column in 0..<3 {
                let x = Float(column - 1) * 1.0
                let z = Float(row) * 0.85 - 2.35
                addBox(
                    to: root,
                    name: "ClassroomDesk",
                    position: SIMD3<Float>(x, -0.20, z),
                    size: SIMD3<Float>(0.64, 0.16, 0.42),
                    color: UIColor(red: 0.46, green: 0.28, blue: 0.14, alpha: 1)
                )
            }
        }
    }

    private func addColumns(to root: Entity, color: UIColor = UIColor(red: 0.70, green: 0.66, blue: 0.58, alpha: 1)) {
        for x in [-2.8, -1.4, 1.4, 2.8] as [Float] {
            addBox(
                to: root,
                name: "SceneColumn",
                position: SIMD3<Float>(x, 0.25, -3.65),
                size: SIMD3<Float>(0.22, 1.6, 0.22),
                color: color
            )
        }
    }

    private func addDisplayPlinths(to root: Entity) {
        for x in [-1.2, 0, 1.2] as [Float] {
            addBox(
                to: root,
                name: "MuseumPlinth",
                position: SIMD3<Float>(x, -0.28, -2.8),
                size: SIMD3<Float>(0.45, 0.5, 0.45),
                color: UIColor(red: 0.78, green: 0.76, blue: 0.70, alpha: 1)
            )
        }
    }

    private func addLowBlocks(to root: Entity, color: UIColor, z: Float, count: Int) {
        for index in 0..<count {
            let x = Float(index) * 0.85 - Float(count - 1) * 0.425
            addBox(
                to: root,
                name: "SceneLowBlock",
                position: SIMD3<Float>(x, -0.40, z),
                size: SIMD3<Float>(0.58, 0.25, 0.30),
                color: color
            )
        }
    }

    private func addShelves(to root: Entity) {
        for x in [-2.4, 2.4] as [Float] {
            addBox(
                to: root,
                name: "LibraryShelf",
                position: SIMD3<Float>(x, 0.40, -3.7),
                size: SIMD3<Float>(0.88, 1.75, 0.28),
                color: UIColor(red: 0.22, green: 0.12, blue: 0.06, alpha: 1)
            )
            for shelf in 0..<4 {
                addBox(
                    to: root,
                    name: "LibraryBooks",
                    position: SIMD3<Float>(x, Float(shelf) * 0.35 - 0.10, -3.53),
                    size: SIMD3<Float>(0.72, 0.11, 0.05),
                    color: UIColor(red: 0.50, green: 0.20, blue: 0.13, alpha: 1)
                )
            }
        }
    }

    private func addReadingTables(to root: Entity) {
        for x in [-0.65, 0.65] as [Float] {
            addBox(
                to: root,
                name: "LibraryTable",
                position: SIMD3<Float>(x, -0.25, -2.45),
                size: SIMD3<Float>(0.75, 0.18, 0.48),
                color: UIColor(red: 0.36, green: 0.20, blue: 0.10, alpha: 1)
            )
        }
    }

    private func addTelescope(to root: Entity) {
        addBox(
            to: root,
            name: "TelescopeTripod",
            position: SIMD3<Float>(0, -0.20, -2.3),
            size: SIMD3<Float>(0.16, 0.65, 0.16),
            color: UIColor(red: 0.42, green: 0.43, blue: 0.48, alpha: 1)
        )
        addBox(
            to: root,
            name: "TelescopeTube",
            position: SIMD3<Float>(0, 0.18, -2.45),
            size: SIMD3<Float>(0.80, 0.16, 0.16),
            color: UIColor(red: 0.70, green: 0.72, blue: 0.78, alpha: 1)
        )
    }

    private func addStarMarkers(to root: Entity) {
        for index in 0..<10 {
            let x = Float(index % 5 - 2) * 0.75
            let y = Float(index / 5) * 0.45 + 0.65
            addBox(
                to: root,
                name: "StarMarker",
                position: SIMD3<Float>(x, y, -4.08),
                size: SIMD3<Float>(0.06, 0.06, 0.02),
                color: UIColor(red: 0.86, green: 0.88, blue: 1.0, alpha: 1),
                roughness: 0.2
            )
        }
    }

    // MARK: - Item Entities

    private func createItemEntity(_ item: PalaceItem) -> Entity {
        let entity = Entity()
        entity.name = item.id
        entity.position = item.position
        updateDisplayPosition(for: entity, item: item)

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
                    // Download USDZ (geometry only — MaterialX shaders are ignored by RealityKit)
                    let assetURL = try await AssetAPIService.shared.downloadAssetAsUSDZ(assetId: assetId)
                    let model = try await Entity(contentsOf: assetURL)

                    // Immediately apply grey so model is never red while texture loads
                    Self.applyFallbackMaterial(to: model)

                    // Then replace with actual diffuse texture from backend
                    await Self.applyPolyhavenTexture(assetId: assetId, to: model)

                    // Auto-scale to fit within ~0.3m
                    let bounds = model.visualBounds(relativeTo: nil)
                    let maxDim = max(bounds.extents.x, max(bounds.extents.y, bounds.extents.z))
                    if maxDim > 0.001 {
                        model.scale *= 0.3 / maxDim
                    }
                    let scaledBounds = model.visualBounds(relativeTo: model)
                    let bottomY = scaledBounds.center.y - (scaledBounds.extents.y / 2)
                    model.position.y -= bottomY
                    model.name = "LoadedModel_\(itemId)"

                    entity.components.remove(ModelComponent.self)
                    entity.addChild(model)

                    let newBounds = entity.visualBounds(relativeTo: nil)
                    if newBounds.extents.x > 0 {
                        entity.components.set(CollisionComponent(shapes: [.generateBox(size: newBounds.extents)]))
                    }
                } catch {
                    palaceVM.errorMessage = "Failed to load 3D model: \(error.localizedDescription)"
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

    private func updateDisplayPosition(for entity: Entity, item: PalaceItem) {
        entity.position = item.position
        if item.displayType == "3d_model" {
            entity.position.y = Self.groundedModelY
        }
    }

    private static let groundedModelY: Float = -0.35
    private static let hdriSkyboxRadius: Float = 60.0
    private static let skyboxMovementMultiplier: Float = 8.0
    private static let maxSkyboxOffset: Float = 30.0

    // MARK: - Material Fix (Polyhaven MaterialX → RealityKit PBR)

    /// Replace all materials on entity tree with PhysicallyBasedMaterial using downloaded textures.
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
            let materialCount = max(1, mc.materials.count)
            mc.materials = (0..<materialCount).enumerated().map { index, _ in
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

    private func attachmentPosition(for entity: Entity, isExpanded: Bool) -> SIMD3<Float> {
        if let model = entity.children.first(where: { $0.name.hasPrefix("LoadedModel_") }) {
            let bounds = model.visualBounds(relativeTo: entity)
            if bounds.extents.x > 0 || bounds.extents.y > 0 || bounds.extents.z > 0 {
                let sideOffset = (bounds.extents.x / 2) + (isExpanded ? 0.16 : 0)
                return SIMD3<Float>(
                    bounds.center.x + sideOffset,
                    bounds.center.y + (bounds.extents.y / 2) + 0.08,
                    bounds.center.z + (isExpanded ? 0.06 : 0)
                )
            }
        }

        return isExpanded ? SIMD3<Float>(0.28, 0.38, 0.10) : SIMD3<Float>(0, 0.35, 0.12)
    }

    private func aiContext(for item: PalaceItem) -> String {
        var lines: [String] = []

        if let palace = appModel.currentPalace {
            lines.append("Palace name: \(palace.name)")
            if let description = palace.description,
               !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                lines.append("Palace description: \(description)")
            }
            lines.append("Palace mode: \(palace.mode.uppercased())")
            if let skyboxPreset = palace.skyboxPreset {
                lines.append("Scene preset: \(skyboxPreset)")
            }
        }

        lines.append("Object id: \(item.id)")
        lines.append("Object name: \(item.label ?? "Unnamed object")")
        lines.append("Object display type: \(item.displayType)")

        if let customText = item.customText,
           !customText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            lines.append("Memory text attached to object:\n\(customText)")
        }
        if let assetId = item.assetId {
            lines.append("3D model asset id: \(assetId)")
        }
        if let flashcardId = item.flashcardId {
            lines.append("Attached flashcard id: \(flashcardId)")
        }
        if let conceptId = item.conceptId {
            lines.append("Attached concept id: \(conceptId)")
        }

        return lines.joined(separator: "\n")
    }

    private func saveMemoryNote(_ note: ObjectSceneMemoryNote, for item: PalaceItem) async {
        let trimmedObjectName = note.objectName.trimmingCharacters(in: .whitespacesAndNewlines)
        let success = await palaceVM.updateMemoryText(
            itemId: item.id,
            customText: note.toCustomText(),
            label: trimmedObjectName.isEmpty ? item.label : trimmedObjectName
        )

        if success {
            memorySaveError = nil
            if let refreshed = palaceVM.items.first(where: { $0.id == item.id }) {
                memoryTargetItem = refreshed
            }
            appModel.palaceItemRefreshTrigger += 1
        } else {
            memorySaveError = palaceVM.errorMessage ?? "Failed to save memory note."
        }
    }

    private func selectItem(_ item: PalaceItem) {
        selectedItem = item
        showReviewOverlay = true
        expandedItemId = item.id
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

    private func handleTap(on entity: Entity) {
        guard let itemEntity = palaceItemEntity(from: entity),
              let highlight = itemEntity.components[HighlightComponent.self] else { return }
        if let item = palaceVM.items.first(where: { $0.id == highlight.itemId }) {
            selectItem(item)
        }
    }

    @State private var dragStartPosition: SIMD3<Float>?

    private func handleDrag(_ value: EntityTargetValue<DragGesture.Value>) {
        guard let itemEntity = palaceItemEntity(from: value.entity),
              let parent = itemEntity.parent else { return }

        if dragStartPosition == nil {
            dragStartPosition = itemEntity.position
        }

        let start = value.convert(value.startLocation3D, from: .local, to: parent)
        let current = value.convert(value.location3D, from: .local, to: parent)
        let delta = current - start
        itemEntity.position = (dragStartPosition ?? .zero) + delta
    }

    private func handleDragEnd(_ entity: Entity) {
        guard let itemEntity = palaceItemEntity(from: entity),
              let highlight = itemEntity.components[HighlightComponent.self] else { return }
        let pos = itemEntity.position
        Task {
            await palaceVM.updatePosition(itemId: highlight.itemId, x: pos.x, y: pos.y, z: pos.z)
        }
        groundedItemIds.insert(highlight.itemId)
        dragStartPosition = nil
    }

    private func palaceItemEntity(from entity: Entity) -> Entity? {
        var current: Entity? = entity
        while let candidate = current {
            if candidate.components[HighlightComponent.self] != nil {
                return candidate
            }
            current = candidate.parent
        }
        return nil
    }

    // MARK: - Texture Application

    /// Downloads only the diffuse/colour JPG from the thumbnail endpoint
    /// (already proxied by our backend) and applies it as a PBR material.
    /// This gives correct colours without downloading all texture maps.
    @MainActor
    private static func applyPolyhavenTexture(assetId: String, to entity: Entity) async {
        let cacheKey = "diff_\(assetId)_512.jpg"
        guard let cachesBase = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return }
        let cacheDir = cachesBase.appendingPathComponent("AssetCache", isDirectory: true)
        let cachedFile = cacheDir.appendingPathComponent(cacheKey)

        var diffuseURL: URL? = nil

        // Check cached texture — but reject zero-byte files (failed previous download)
        if FileManager.default.fileExists(atPath: cachedFile.path),
           let size = try? FileManager.default.attributesOfItem(atPath: cachedFile.path)[.size] as? Int,
           size > 1024 {
            diffuseURL = cachedFile
        } else {
            try? FileManager.default.removeItem(at: cachedFile)
            // Download diffuse thumbnail from our backend proxy (small JPG)
            let urlStr = "\(BackendConfig.baseURL)/api/models/\(assetId)/thumbnail"
            if let url = URL(string: urlStr) {
                var request = URLRequest(url: url)
                if let token = KeychainService.get(forKey: "access_token") {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                if let (tmp, _) = try? await URLSession.shared.download(for: request) {
                    try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
                    try? FileManager.default.moveItem(at: tmp, to: cachedFile)
                    diffuseURL = cachedFile
                }
            }
        }

        guard let diffuseURL,
              let texture = try? await TextureResource(contentsOf: diffuseURL) else {
            // Fallback: neutral grey so model is at least visible
            applyFallbackMaterial(to: entity)
            return
        }

        applyTextureRecursive(texture: texture, to: entity)
    }

    private static func applyTextureRecursive(texture: TextureResource, to entity: Entity) {
        if var mc = entity.components[ModelComponent.self] {
            let count = max(1, mc.materials.count)
            mc.materials = (0..<count).map { _ in
                var mat = PhysicallyBasedMaterial()
                mat.baseColor = .init(tint: .white, texture: .init(texture))
                mat.roughness = .init(floatLiteral: 0.7)
                mat.metallic  = .init(floatLiteral: 0.0)
                return mat as any RealityKit.Material
            }
            entity.components.set(mc)
        }
        for child in entity.children {
            applyTextureRecursive(texture: texture, to: child)
        }
    }

    private static func applyFallbackMaterial(to entity: Entity) {
        if var mc = entity.components[ModelComponent.self] {
            let count = max(1, mc.materials.count)
            mc.materials = (0..<count).map { _ in
                var mat = PhysicallyBasedMaterial()
                mat.baseColor = .init(tint: UIColor(white: 0.85, alpha: 1))
                mat.roughness = .init(floatLiteral: 0.7)
                mat.metallic  = .init(floatLiteral: 0.0)
                return mat as any RealityKit.Material
            }
            entity.components.set(mc)
        }
        for child in entity.children {
            applyFallbackMaterial(to: child)
        }
    }
}
#endif
