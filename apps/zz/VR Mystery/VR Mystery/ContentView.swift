//
//  ContentView.swift
//  VR Mystery
//
//  Created by itst on 27/1/2026.
//

import SwiftUI
import RealityKit

struct ContentView: View {
    @Environment(AppModel.self) private var appModel

    var body: some View {
        VStack(spacing: 20) {
            Text("VR Mystery Game Demo")
                .font(.largeTitle)

            ToggleImmersiveSpaceButton()

            Button("Import Scene") {
                // This is a fake button, so it doesn't do anything.
                print("Import Scene button tapped.")
            }

            if appModel.immersiveSpaceState == .open {
                if appModel.isShowingDecision {
                    DecisionView()
                } else {
                    Text("You are in the immersive space. Look around and interact with objects.")
                        .multilineTextAlignment(.center)
                }
            }
        }
        .padding()
    }
}

/// A view that presents a decision to the user.
struct DecisionView: View {
    @Environment(AppModel.self) private var appModel

    var body: some View {
        VStack(spacing: 20) {
            Text("The \(appModel.npcName) looks at you expectantly.")
                .font(.title)

            Text("What do you do?")

            Button("Accuse them of lying") {
                // This is the wrong choice, leading to a consequence.
                appModel.npcIsAlive = false
                appModel.isShowingDecision = false
            }

            Button("Ask for more evidence") {
                // This is a safe choice. In a real game, this would lead to more dialogue.
                appModel.isShowingDecision = false
            }
        }
        .padding()
        .glassBackgroundEffect()
        .frame(width: 400)
    }
}

#Preview(windowStyle: .automatic) {
    ContentView()
        .environment(AppModel())
}
