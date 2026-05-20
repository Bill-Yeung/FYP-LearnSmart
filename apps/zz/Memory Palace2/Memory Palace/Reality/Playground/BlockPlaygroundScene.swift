//
//  BlockPlaygroundScene.swift
//  Testing Ground
//
//  Created by ituser on 22/1/2026.
//

import SwiftUI
import RealityKit
import Combine
import UIKit

#if os(visionOS)
/// Marker component so we only target "our" draggable blocks (not the floor, not other content).
struct DraggableComponent: Component {}

@MainActor
final class BlockPlaygroundScene: ObservableObject {

    // Public toggles you can wire to UI
    @Published var lockToTablePlane: Bool = true
    @Published var selectedName: String? = nil

    // Scene graph
    private let root = Entity()
    private var installed = false

    // Simple “table” plane
    private let tableY: Float = -0.12

    // Sizing
    private let blockSize: Float = 0.08

    // Selection + dragging state
    private weak var selectedEntity: ModelEntity?
    private var originalScaleByID: [ObjectIdentifier: SIMD3<Float>] = [:]
    private var dragOffsetByID: [ObjectIdentifier: SIMD3<Float>] = [:]

    func installIfNeeded(into content: RealityViewContent) {
        guard !installed else { return }
        installed = true

        // Add a root container so every block has a stable parent for coordinate conversion.
        content.add(root)

        addTable()
        addInitialBlocks()
    }	

    func reset() {
        // Remove everything except root itself, then recreate table + blocks.
        for child in root.children {
            child.removeFromParent()
        }
        selectedEntity = nil
        selectedName = nil
        originalScaleByID.removeAll()
        dragOffsetByID.removeAll()

        addTable()
        addInitialBlocks()
    }

    func addRandomBlock() {
        let colors: [UIColor] = [.systemRed, .systemBlue, .systemGreen, .systemOrange, .systemPurple, .systemTeal]
        let color = colors.randomElement() ?? .systemBlue

        // Scatter within a small region in front of the window origin.
        let x = Float.random(in: -0.18 ... 0.18)
        let z = Float.random(in: -0.18 ... 0.18)

        let y = lockToTablePlane ? (tableY + blockSize / 2) : Float.random(in: -0.05 ... 0.12)
        let name = "Block \(Int.random(in: 100...999))"

        let block = makeBlock(name: name, color: color)
        block.position = [x, y, z]
        root.addChild(block)
    }

    func dragGesture() -> some Gesture {
        DragGesture()
            .targetedToEntity(where: .has(DraggableComponent.self))
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
            .targetedToEntity(where: .has(DraggableComponent.self))
            .onEnded { [weak self] value in
                guard let self else { return }
                if let model = value.entity as? ModelEntity {
                    self.select(model)
                }
            }
    }

    // MARK: - Private helpers

    private func addTable() {
        // Plane as a very thin box (simple, reliable mesh signature).
        let mesh = MeshResource.generateBox(width: 0.8, height: 0.01, depth: 0.8, cornerRadius: 0.02)
        let mat = SimpleMaterial(color: UIColor(white: 0.85, alpha: 1.0), isMetallic: false)
        let table = ModelEntity(mesh: mesh, materials: [mat])

        table.name = "Table"
        table.position = [0, tableY, 0]

        // Collisions so you can later do snapping / bounds checks if you want.
        table.generateCollisionShapes(recursive: true)

        root.addChild(table)
    }

    private func addInitialBlocks() {
        let y = lockToTablePlane ? (tableY + blockSize / 2) : 0

        let a = makeBlock(name: "A", color: .systemBlue)
        a.position = [-0.15, y, -0.05]

        let b = makeBlock(name: "B", color: .systemGreen)
        b.position = [0.00, y, 0.05]

        let c = makeBlock(name: "C", color: .systemOrange)
        c.position = [0.15, y, -0.02]

        root.addChild(a)
        root.addChild(b)
        root.addChild(c)
    }

    private func makeBlock(name: String, color: UIColor) -> ModelEntity {
        let mesh = MeshResource.generateBox(width: blockSize, height: blockSize, depth: blockSize, cornerRadius: 0.01)
        let mat = SimpleMaterial(color: color, isMetallic: false)

        let block = ModelEntity(mesh: mesh, materials: [mat])
        block.name = name

        // Required for direct targeting and gesture interaction:
        block.generateCollisionShapes(recursive: true)
        block.components.set(InputTargetComponent())

        // Marker for our gesture filters:
        block.components.set(DraggableComponent())

        // Nice UX: a subtle hover highlight in visionOS.
        block.components.set(HoverEffectComponent())

        return block
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
        guard let entity = value.entity as? ModelEntity, let parent = entity.parent else { return }

        let id = ObjectIdentifier(entity)

        // Capture the offset once at the start of the drag so the block doesn’t “snap”
        // to the fingertip’s contact point.
        if dragOffsetByID[id] == nil {
            let startInParent = value.convert(value.startLocation3D, from: .local, to: parent)
            dragOffsetByID[id] = entity.position - startInParent
        }

        var locationInParent = value.convert(value.location3D, from: .local, to: parent)
        if let offset = dragOffsetByID[id] {
            locationInParent += offset
        }

        if lockToTablePlane {
            locationInParent.y = tableY + blockSize / 2
        }

        entity.position = locationInParent
    }
}
#endif
