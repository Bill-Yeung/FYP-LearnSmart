//
//  SessionView.swift
//  Testing Ground
//
//  Created by ituser on 29/1/2026.
//

import SwiftUI

struct SessionView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Session").font(.largeTitle).fontWeight(.semibold)
            Text("UI-first placeholder. Later: start/continue workspace selector.")
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding()
        .navigationTitle("Session")
    }
}
