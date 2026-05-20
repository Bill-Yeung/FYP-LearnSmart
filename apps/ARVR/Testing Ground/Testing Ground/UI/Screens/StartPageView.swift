//
//  StartPageView.swift
//  Testing Ground
//
//  Created by assistant on 10/2/2026.
//

import SwiftUI

struct StartPageView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Start")
                .font(.largeTitle)
                .fontWeight(.semibold)

            Text("Choose a 3D object to add to your AR/VR scene.")
                .foregroundStyle(.secondary)

            Divider()

            // Embed the object library list
            ObjectLibraryView()

            Spacer()
        }
        .padding()
        .navigationTitle("Start")
    }
}
