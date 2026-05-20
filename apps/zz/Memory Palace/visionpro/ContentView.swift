//
//  ContentView.swift
//  vr
//
//  Created by ituser on 3/3/2026.
//

import SwiftUI

struct ContentView: View {

    var body: some View {
        RootView()
    }
}

#Preview(windowStyle: .automatic) {
    ContentView()
        .environment(AppModel())
}
