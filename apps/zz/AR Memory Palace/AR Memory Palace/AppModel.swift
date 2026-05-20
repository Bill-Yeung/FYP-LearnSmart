//
//  AppModel.swift
//  AR Memory Palace
//
//  Created by itst on 26/1/2026.
//

import SwiftUI

/// Maintains app-wide state
@MainActor
@Observable
class AppModel {
    let immersiveSpaceID = "ImmersiveSpace"
    enum ImmersiveSpaceState {
        case closed
        case inTransition
        case open
    }
    var immersiveSpaceState = ImmersiveSpaceState.closed
    
    enum ObjectType: String, CaseIterable, Identifiable {
        case sphere = "Sphere"
        case cube = "Cube"
        case flashCard = "Flash Card"
        var id: Self { self }
    }
    var selectedObjectType: ObjectType = .sphere
}
