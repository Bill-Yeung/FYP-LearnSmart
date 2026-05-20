//
//  PalaceViewModel.swift
//  AR Testing
//
//  Created by ituser on 10/2/2026.
//


import Foundation
import Combine

final class PalaceViewModel: ObservableObject {
    @Published var selectedLocusID: String? = nil
    @Published var tapCount: Int = 0

    func select(_ id: String) {
        selectedLocusID = id
        tapCount += 1
    }

    func clearSelection() {
        selectedLocusID = nil
    }
}
