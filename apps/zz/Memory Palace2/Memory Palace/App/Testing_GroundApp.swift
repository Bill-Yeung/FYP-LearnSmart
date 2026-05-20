//
//  Testing_GroundApp.swift
//  Testing Ground
//
//  Created by ituser on 22/1/2026.
//

import SwiftUI
import RealityKit

@main
struct Testing_GroundApp: App {

    @State private var appModel = AppModel()

    init() {
        HighlightComponent.registerComponent()
        HighlightSystem.registerSystem()
    }

    var body: some SwiftUI.Scene {
        WindowGroup {
            RootView()
                .environment(appModel)
        }

        ImmersiveSpace(id: appModel.immersiveSpaceID) {
            ImmersiveView()
                .environment(appModel)
                .onAppear {
                    appModel.immersiveSpaceState = .open
                }
                .onDisappear {
                    let wasTransitioning = appModel.immersiveSpaceState == .inTransition
                    appModel.immersiveSpaceState = .closed
                    if !wasTransitioning {
                        appModel.currentPalace = nil
                    }
                }
        }
        .immersionStyle(selection: .constant(appModel.immersionMode == .ar ? .mixed : .full), in: .mixed, .full)
    }
}
