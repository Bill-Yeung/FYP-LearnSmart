//
//  VR_MysteryApp.swift
//  VR Mystery
//
//  Created by itst on 27/1/2026.
//

import SwiftUI

@main
struct VR_MysteryApp: App {
    
    @State private var appModel = AppModel()
    @State private var avPlayerViewModel = AVPlayerViewModel()
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    
    var body: some Scene {
        WindowGroup {
            Group {
                if avPlayerViewModel.isPlaying {
                    AVPlayerView(viewModel: avPlayerViewModel)
                } else {
                    ContentView()
                        .environment(appModel)
                        .environment(avPlayerViewModel)
                }
            }
            .onOpenURL { url in
                print("Received URL:", url)
                if url.host == "xr" || url.host == "open" {
                    Task {
                        await openImmersiveSpace(id: appModel.immersiveSpaceID)
                    }
                }
            }
        }
        
        ImmersiveSpace(id: appModel.immersiveSpaceID) {
            ImmersiveView()
                .environment(appModel)
                .environment(avPlayerViewModel)
                .onAppear {
                    appModel.immersiveSpaceState = .open
                }
                .onDisappear {
                    appModel.immersiveSpaceState = .closed
                    // Reset game state when leaving the immersive space
                    appModel.isShowingDecision = false
                    appModel.npcIsAlive = true
                    avPlayerViewModel.reset()
                }
        }
        .immersionStyle(selection: .constant(.full), in: .full)
    }
}
