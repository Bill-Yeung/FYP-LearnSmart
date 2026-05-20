//
//  ImmersiveView.swift
//  Testing Ground
//
//  Created by itst on 5/3/2026.
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

#if os(visionOS)
#Preview(immersionStyle: .full) {
    ImmersiveView()
        .environment(AppModel())
}
#endif
