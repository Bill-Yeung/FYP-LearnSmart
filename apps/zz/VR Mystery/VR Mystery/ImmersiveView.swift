//
//  ImmersiveView.swift
//  VR Mystery
//
//  Created by itst on 27/1/2026.
//

import SwiftUI
import RealityKit
import RealityKitContent

struct ImmersiveView: View {
    @Environment(AppModel.self) private var appModel
    @Environment(AVPlayerViewModel.self) private var avPlayerViewModel

    var body: some View {
        RealityView { content in
            // Add the initial RealityKit content
            if let immersiveContentEntity = try? await Entity(named: "Immersive", in: realityKitContentBundle) {
                content.add(immersiveContentEntity)
            }

            // Create and add an NPC
            let npcMaterial = SimpleMaterial(color: .systemBlue, isMetallic: false)
            let npc = ModelEntity(
                mesh: .generateSphere(radius: 0.3),
                materials: [npcMaterial]
            )
            npc.name = appModel.npcName
            npc.position = [ -1, 1.5, -2]
            npc.components.set(InputTargetComponent())
            npc.components.set(CollisionComponent(shapes: [.generateSphere(radius: 0.3)]))
            content.add(npc)

            // Create and add a clue object to play a video
            let clueMaterial = SimpleMaterial(color: .systemYellow, isMetallic: false)
            let clue = ModelEntity(
                mesh: .generateBox(size: 0.2),
                materials: [clueMaterial]
            )
            clue.name = "Clue"
            clue.position = [1, 1.2, -2]
            clue.components.set(InputTargetComponent())
            clue.components.set(CollisionComponent(shapes: [.generateBox(size: [0.2, 0.2, 0.2])]))
            content.add(clue)

        } update: { content in
            // Update NPC appearance based on state
            if let npc = content.entities.first(where: { $0.name == appModel.npcName }) as? ModelEntity {
                let newMaterial = SimpleMaterial(color: appModel.npcIsAlive ? .systemBlue : .systemRed, isMetallic: false)
                npc.model?.materials = [newMaterial]
            }
        }
        .gesture(TapGesture().targetedToAnyEntity().onEnded { value in
            // Don't allow interaction if the NPC is not "alive"
            guard appModel.npcIsAlive else { return }

            switch value.entity.name {
            case appModel.npcName:
                // Tapped the NPC, show decision UI in the main window.
                appModel.isShowingDecision = true
            case "Clue":
                // Tapped the clue, play the video.
                // This will switch the WindowGroup's content to the AVPlayerView.
                avPlayerViewModel.play()
            default:
                break
            }
        })
    }
}

#Preview(immersionStyle: .full) {
    ImmersiveView()
        .environment(AppModel())
        .environment(AVPlayerViewModel())
}
