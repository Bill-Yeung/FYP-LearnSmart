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
    @State private var authVM = AuthViewModel()
    #if os(visionOS)
    @State private var immersionStyle: ImmersionStyle = .full
    #endif

    init() {
        HighlightComponent.registerComponent()
        HighlightSystem.registerSystem()
    }

    var body: some SwiftUI.Scene {
        WindowGroup {
            RootView()
                .environment(appModel)
                .environment(authVM)
                #if os(visionOS)
                .onChange(of: appModel.immersionMode) { _, _ in
                    immersionStyle = .full
                }
                #endif
                .onOpenURL { url in
                    // memorypalace://open  — just bring app to foreground
                    // memorypalace://palace/PALACE_ID  — open a specific palace
                    appModel.handleDeepLink(url)
                }
        }

        #if os(visionOS)
        WindowGroup(id: AppModel.LibraryWindowID.models) {
            NavigationStack {
                ObjectLibraryView(
                    initialTab: .models,
                    lockedMode: .models,
                    showsTabs: false,
                    title: "Models"
                )
            }
            .environment(appModel)
            .environment(authVM)
        }
        .defaultSize(width: 680, height: 640)

        WindowGroup(id: AppModel.LibraryWindowID.concepts) {
            NavigationStack {
                ObjectLibraryView(
                    initialTab: .concepts,
                    lockedMode: .concepts,
                    showsTabs: false,
                    title: "Concepts"
                )
            }
            .environment(appModel)
            .environment(authVM)
        }
        .defaultSize(width: 680, height: 640)

        WindowGroup(id: AppModel.LibraryWindowID.flashcards) {
            NavigationStack {
                ObjectLibraryView(
                    initialTab: .flashcards,
                    lockedMode: .flashcards,
                    showsTabs: false,
                    title: "Flashcards"
                )
            }
            .environment(appModel)
            .environment(authVM)
        }
        .defaultSize(width: 680, height: 640)

        WindowGroup(id: AppModel.LibraryWindowID.scenes) {
            NavigationStack {
                ObjectLibraryView(
                    initialTab: .scenes,
                    lockedMode: .scenes,
                    showsTabs: false,
                    title: "Scenes"
                )
            }
            .environment(appModel)
            .environment(authVM)
        }
        .defaultSize(width: 680, height: 640)

        WindowGroup(id: AppModel.ItemWindowID.detail) {
            PalaceItemDetailWindow()
                .environment(appModel)
                .environment(authVM)
        }
        .defaultSize(width: 460, height: 520)

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
        .immersionStyle(selection: $immersionStyle, in: .mixed, .full)
        #endif
    }
}
