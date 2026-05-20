//
//  ImmersivePalaceView.swift
//  AR Testing
//
//  Created by ituser on 10/2/2026.
//


import SwiftUI
import RealityKit
import UIKit

struct ImmersivePalaceView: View {
    @EnvironmentObject private var model: PalaceViewModel

    @State private var isSetup = false
    @State private var root = Entity()

    @State private var loci: [String: ModelEntity] = [:]
    @State private var normalMaterials: [String: UnlitMaterial] = [:]
    @State private var highlightMaterial = UnlitMaterial(color: UIColor.systemYellow)

    var body: some View {
        RealityView { content in
            if !isSetup {
                buildRoomAndLoci()
                content.add(root)
                isSetup = true
            }
        } update: { _ in
            applySelectionVisuals()
        }
        .gesture(
            TapGesture()
                .targetedToAnyEntity()
                .onEnded { value in
                    // Walk up parents to find an entity named "locus:<id>"
                    var e: Entity? = value.entity
                    while let cur = e, !cur.name.hasPrefix("locus:") {
                        e = cur.parent
                    }
                    guard let hit = e else { return }
                    let id = String(hit.name.dropFirst("locus:".count))
                    model.select(id)
                }
        )
    }

    private func buildRoomAndLoci() {
        // Simple unlit materials so you can always see them in mixed/progressive/full.
        let wallMat = UnlitMaterial(color: UIColor(white: 0.22, alpha: 1.0))
        let floorMat = UnlitMaterial(color: UIColor(white: 0.15, alpha: 1.0))

        // Floor
        let floor = ModelEntity(
            mesh: .generateBox(width: 4.0, height: 0.03, depth: 4.0),
            materials: [floorMat]
        )
        floor.position = [0, -1.2, 0]
        root.addChild(floor)

        // 4 walls (thin boxes)
        func wall(width: Float, height: Float, depth: Float, pos: SIMD3<Float>) -> ModelEntity {
            let w = ModelEntity(mesh: .generateBox(width: width, height: height, depth: depth), materials: [wallMat])
            w.position = pos
            root.addChild(w)
            return w
        }

        _ = wall(width: 4.0, height: 2.4, depth: 0.03, pos: [0, -0.0, -2.0]) // back
        _ = wall(width: 4.0, height: 2.4, depth: 0.03, pos: [0, -0.0,  2.0]) // front
        _ = wall(width: 0.03, height: 2.4, depth: 4.0, pos: [-2.0, -0.0, 0]) // left
        _ = wall(width: 0.03, height: 2.4, depth: 4.0, pos: [ 2.0, -0.0, 0]) // right

        // Loci (tappable spheres sitting on small pedestals)
        let locusPositions: [(String, SIMD3<Float>, UIColor)] = [
            ("A", [-1.0, -0.35, -0.8], .systemTeal),
            ("B", [ 0.0, -0.35, -0.8], .systemPink),
            ("C", [ 1.0, -0.35, -0.8], .systemOrange),
            ("D", [-0.5, -0.35,  0.6], .systemGreen),
            ("E", [ 0.5, -0.35,  0.6], .systemIndigo)
        ]

        for (id, pos, color) in locusPositions {
            let pedestal = ModelEntity(
                mesh: .generateBox(width: 0.22, height: 0.45, depth: 0.22),
                materials: [UnlitMaterial(color: UIColor(white: 0.30, alpha: 1.0))]
            )
            pedestal.position = [pos.x, -0.70, pos.z]
            root.addChild(pedestal)

            let mat = UnlitMaterial(color: color)
            let sphere = ModelEntity(mesh: .generateSphere(radius: 0.12), materials: [mat])
            sphere.position = pos
            sphere.name = "locus:\(id)"

            // Make it tappable.
            sphere.generateCollisionShapes(recursive: true)
            sphere.components.set(InputTargetComponent(allowedInputTypes: .all))
            sphere.components.set(HoverEffectComponent())

            root.addChild(sphere)
            loci[id] = sphere
            normalMaterials[id] = mat
        }
    }

    private func applySelectionVisuals() {
        let selected = model.selectedLocusID

        for (id, entity) in loci {
            let isSelected = (id == selected)
            entity.transform.scale = SIMD3<Float>(repeating: isSelected ? 1.35 : 1.0)

            if isSelected {
                entity.model?.materials = [highlightMaterial]
            } else if let mat = normalMaterials[id] {
                entity.model?.materials = [mat]
            }
        }
    }
}
