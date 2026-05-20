//
//  ContentView.swift
//  AR Testing
//
//  Created by ituser on 10/2/2026.
//

import SwiftUI

enum ImmersionMode: String, CaseIterable, Hashable {
    case mixed
    case progressive
    case full

    var title: String {
        switch self {
        case .mixed:       return "Mixed (AR-like)"
        case .progressive: return "Progressive"
        case .full:        return "Full (VR-like)"
        }
    }
}

struct ContentView: View {
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @EnvironmentObject private var model: PalaceViewModel

    @Binding var immersionStyle: ImmersionStyle
    @State private var mode: ImmersionMode = .progressive
    
    @State private var isSpaceOpen = false
    @State private var statusText: String = "Shared Space (window) is running."

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Memory Palace Mode Switch Demo")
                .font(.title2)

            Picker("Immersion", selection: $mode) {
                ForEach(ImmersionMode.allCases, id: \.self) { mode in
                    Text(mode.title).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .onAppear { apply(mode) }
            .onChange(of: mode) { _, newValue in
                apply(newValue)
            }

            HStack(spacing: 12) {
                Button(isSpaceOpen ? "Exit Palace" : "Enter Palace") {
                    Task {
                        if isSpaceOpen {
                            await dismissImmersiveSpace()
                            isSpaceOpen = false
                            statusText = "Exited immersive space."
                        } else {
                            let result = await openImmersiveSpace(id: "palace")
                            if result == .opened {
                                isSpaceOpen = true
                                statusText = "Entered immersive space."
                            } else {
                                statusText = "Failed to open immersive space: \(String(describing: result))"
                            }
                        }
                    }
                }
                .buttonStyle(.borderedProminent)

                Button("Clear Selection") {
                    model.clearSelection()
                }
                .buttonStyle(.bordered)
            }

            Divider()

            Text("Selected locus: \(model.selectedLocusID ?? "none")")
                .font(.headline)

            Text("Tap count: \(model.tapCount)")
                .font(.subheadline)

            Text(statusText)
                .font(.footnote)
                .foregroundStyle(.secondary)

            Spacer()
        }
        .padding(20)
        .frame(minWidth: 520, minHeight: 360)
    }
    
    private func apply(_ mode: ImmersionMode) {
        switch mode {
        case .mixed:
            immersionStyle = .mixed
        case .full:
            immersionStyle = .full
        case .progressive:
            // visionOS 2+ lets you set range + initial amount:
            immersionStyle = .progressive(0.0...1.0, initialAmount: 0.35)
            // If your SDK complains, replace the line above with:
            // immersionStyle = .progressive
        }
    }
}
