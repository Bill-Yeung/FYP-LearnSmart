//
//  ImmersiveModeControls.swift
//  Testing Ground
//
//  Created by copilot on 10/2/2026.
//

import SwiftUI

struct ImmersiveModeControls: View {
    @Environment(AppModel.self) private var appModel

    var body: some View {
        VStack(spacing: 8) {
            Picker(selection: Bindable(appModel).immersionMode, label: Text("Mode")) {
                Text("AR").tag(AppModel.ImmersionMode.ar)
                Text("VR").tag(AppModel.ImmersionMode.vr)
            }
            .pickerStyle(.segmented)
            .frame(width: 160)
        }
        .padding(10)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(color: Color.black.opacity(0.12), radius: 6, x: 0, y: 2)
    }
}
