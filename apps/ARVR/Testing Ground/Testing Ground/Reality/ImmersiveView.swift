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
        #if os(visionOS)
        PalaceImmersiveView()
        #else
        Text("VR mode not available on this platform")
        #endif
    }
}

#if os(visionOS)
#Preview(immersionStyle: .full) {
    ImmersiveView()
        .environment(AppModel())
}
#endif
