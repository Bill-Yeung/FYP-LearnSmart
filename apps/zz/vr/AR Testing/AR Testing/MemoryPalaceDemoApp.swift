//
//  MemoryPalaceDemoApp.swift
//  AR Testing
//
//  Created by ituser on 10/2/2026.
//


import SwiftUI

@main
struct MemoryPalaceDemoApp: App {
    @StateObject private var model = PalaceViewModel()
    @State private var immersionStyle: ImmersionStyle = .progressive

    var body: some Scene {
        WindowGroup(id: "main") {
            ContentView(immersionStyle: $immersionStyle)
                .environmentObject(model)
        }

        ImmersiveSpace(id: "palace") {
            ImmersivePalaceView()
                .environmentObject(model)
        }
        // Allow switching between AR-like and VR-like in the same space.
        .immersionStyle(selection: $immersionStyle, in: .mixed, .progressive, .full)
    }
}
