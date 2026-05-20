//
//  ImmersiveView.swift
//  vr
//
//  Created by ituser on 3/3/2026.
//

import SwiftUI
import RealityKit

struct ImmersiveView: View {
    @Environment(AppModel.self) var appModel

    var body: some View {
        switch appModel.immersionMode {
        case .vr:
            PalaceImmersiveView()
        case .ar:
            ARPlacementView()
        }
    }
}

#Preview(immersionStyle: .full) {
    ImmersiveView()
        .environment(AppModel())
}
