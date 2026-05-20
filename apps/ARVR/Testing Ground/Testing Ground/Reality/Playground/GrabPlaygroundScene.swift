//
//  GrabPlaygroundScene.swift
//  Testing Ground
//
//  Created by ituser on 22/1/2026.
//

import SwiftUI
import RealityKit
import Combine
import UIKit

#if os(visionOS)
/// Marker so our gestures only apply to the objects we spawn.
struct GrabbableComponent: Component {}

@MainActor
final class GrabPlaygroundScene: ObservableObject {

    @Published var selectedName: String? = nil
    @Published var liftOnGrab: Bool = true

    private let root = Entity()
    private var installed = false

    // Drag state (per-entity) to prevent snapping
    private var dragOffsetByID: [ObjectIdentifier: SIMD3<Float>] = [:]

    // Simple selection feedback
    private weak var selectedEntity: ModelEntity?
    private var originalScaleByID: [ObjectIdentifier: SIMD3<Float>] = [:]

    func installIfNeeded(into content: RealityViewContent) {
        guard !installed else { return }
        installed = true

        content.add(root)

        // Spawn a few objects floating in front of the user.
        spawnInitialSet()
    }

    func reset() {
        for child in root.children { child.removeFromParent() }
        selectedEntity = nil
        selectedName = nil
        dragOffsetByID.removeAll()
        originalScaleByID.removeAll()
        spawnInitialSet()
    }

    func addCube() {
        let cube = makeCube(name: "Cube \(Int.random(in: 100...999))",
                            color: randomColor(),
                            size: 0.08)
        cube.position = randomSpawnPosition()
        root.addChild(cube)
    }

    func addSphere() {
        let sphere = makeSphere(name: "Sphere \(Int.random(in: 100...999))",
                                color: randomColor(),
                                radius: 0.045)
        sphere.position = randomSpawnPosition()
        root.addChild(sphere)
    }

    func dragGesture() -> some Gesture {
        DragGesture(minimumDistance: 0)
            .targetedToEntity(where: .has(GrabbableComponent.self))
            .onChanged { [weak self] value in
                guard let self else { return }
                self.updateDrag(value)
            }
            .onEnded { [weak self] value in
                guard let self else { return }
                let id = ObjectIdentifier(value.entity)
                self.dragOffsetByID[id] = nil
            }
    }

    func tapGesture() -> some Gesture {
        SpatialTapGesture()
            .targetedToEntity(where: .has(GrabbableComponent.self))
            .onEnded { [weak self] value in
                guard let self else { return }
                if let model = value.entity as? ModelEntity {
                    self.select(model)
                }
            }
    }

    // MARK: - Internals

    private func spawnInitialSet() {
        let a = makeCube(name: "A", color: .systemBlue, size: 0.08)
        a.position = [-0.14, 0.05, -0.20]

        let b = makeCube(name: "B", color: .systemGreen, size: 0.08)
        b.position = [0.00, 0.10, -0.25]

        let c = makeSphere(name: "C", color: .systemOrange, radius: 0.045)
        c.position = [0.14, 0.03, -0.22]

        root.addChild(a)
        root.addChild(b)
        root.addChild(c)
    }

    private func makeCube(name: String, color: UIColor, size: Float) -> ModelEntity {
        let mesh = MeshResource.generateBox(size: size, cornerRadius: size * 0.12)
        let mat = SimpleMaterial(color: color, isMetallic: false)

        let e = ModelEntity(mesh: mesh, materials: [mat])
        configureGrabbable(e, name: name)
        return e
    }

    private func makeSphere(name: String, color: UIColor, radius: Float) -> ModelEntity {
        let mesh = MeshResource.generateSphere(radius: radius)
        let mat = SimpleMaterial(color: color, isMetallic: false)

        let e = ModelEntity(mesh: mesh, materials: [mat])
        configureGrabbable(e, name: name)
        return e
    }

    private func configureGrabbable(_ entity: ModelEntity, name: String) {
        entity.name = name

        // Required for targeted gestures:
        entity.generateCollisionShapes(recursive: true)
        entity.components.set(InputTargetComponent())

        // UX polish:
        entity.components.set(HoverEffectComponent())

        // Marker:
        entity.components.set(GrabbableComponent())
    }

    private func select(_ entity: ModelEntity) {
        // Unselect previous
        if let prev = selectedEntity {
            let prevID = ObjectIdentifier(prev)
            if let original = originalScaleByID[prevID] {
                prev.scale = original
            }
        }

        selectedEntity = entity
        selectedName = entity.name

        let id = ObjectIdentifier(entity)
        originalScaleByID[id] = entity.scale
        entity.scale = entity.scale * 1.08
    }

    private func updateDrag(_ value: EntityTargetValue<DragGesture.Value>) {
        guard let entity = value.entity as? ModelEntity,
              let parent = entity.parent else { return }

        let id = ObjectIdentifier(entity)

        // Convert gesture’s 3D location into the entity parent’s coordinate space.
        var locationInParent = value.convert(value.location3D, from: .local, to: parent)

        // Capture offset once so the object doesn’t snap to the grab point.
        if dragOffsetByID[id] == nil {
            let startInParent = value.convert(value.startLocation3D, from: .local, to: parent)
            var offset = entity.position - startInParent

            // Optional “pick up” feel: lift a bit at drag start.
            if liftOnGrab {
                offset.y += 0.03
            }

            dragOffsetByID[id] = offset
        }

        if let offset = dragOffsetByID[id] {
            locationInParent += offset
        }

        entity.position = locationInParent
    }

    private func randomSpawnPosition() -> SIMD3<Float> {
        let x = Float.random(in: -0.18 ... 0.18)
        let y = Float.random(in: -0.02 ... 0.18)   // free vertical
        let z = Float.random(in: -0.32 ... -0.16) // in front of the user
        return [x, y, z]
    }

    private func randomColor() -> UIColor {
        [.systemRed, .systemBlue, .systemGreen, .systemOrange, .systemPurple, .systemTeal]
            .randomElement() ?? .systemBlue
    }
}
#endif
