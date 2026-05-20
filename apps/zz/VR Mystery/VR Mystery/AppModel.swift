//
//  AppModel.swift
//  VR Mystery
//
//  Created by itst on 27/1/2026.
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

    // MARK: - Game State

    /// A Boolean value that indicates whether the app is showing the decision UI.
    var isShowingDecision = false
    /// A Boolean value that indicates whether the NPC is "alive".
    var npcIsAlive = true
    /// The name for the NPC entity, used for identification.
    let npcName = "MysteriousFigure"
}
