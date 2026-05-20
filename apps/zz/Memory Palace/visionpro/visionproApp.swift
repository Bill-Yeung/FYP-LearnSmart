import SwiftUI
import RealityKit

@main
struct visionproApp: App {

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
                    // Only clear palace state if this is a real close (user or system)
                    // not a re-entry transition (dismiss→reopen for different palace)
                    let wasTransitioning = appModel.immersiveSpaceState == .inTransition
                    appModel.immersiveSpaceState = .closed
                    if !wasTransitioning {
                        appModel.currentPalace = nil
                    }
                }
        }
        .immersionStyle(selection: .constant(appModel.immersionMode == .ar ? .mixed : .full),
                        in: .mixed, .full)
    }
}
