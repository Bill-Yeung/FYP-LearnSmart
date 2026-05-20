//
//  AR_Memory_PalaceApp.swift
//  AR Memory Palace
//
//  Created by itst on 26/1/2026.
//

import SwiftUI

@main
struct AR_Memory_PalaceApp: App {

    @State private var appModel = AppModel()
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appModel)
                .onOpenURL { url in
                    print("Received URL:", url)
                    // handle scheme like: armemory://xr or armemory://open
                    if url.host == "xr" || url.host == "open" {
                        Task {
                            await openImmersiveSpace(id: appModel.immersiveSpaceID)
                        }
                    }
                }
        }
        .windowStyle(.volumetric)

        ImmersiveSpace(id: appModel.immersiveSpaceID) {
            ImmersiveView()
                .environment(appModel)
                .onAppear {
                    appModel.immersiveSpaceState = .open
                }
                .onDisappear {
                    appModel.immersiveSpaceState = .closed
                }
        }
        .immersionStyle(selection: .constant(.mixed), in: .mixed)
    }
}
