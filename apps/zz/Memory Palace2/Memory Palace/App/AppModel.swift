import SwiftUI
import Observation

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

    // MARK: - Immersion Mode

    enum ImmersionMode: String, CaseIterable, Identifiable {
        case ar = "AR"
        case vr = "VR"

        var id: String { rawValue }
    }
    var immersionMode: ImmersionMode = .ar

    // MARK: - Palace State

    var currentPalace: MemoryPalace?
    var isInsidePalace: Bool { currentPalace != nil }

    // MARK: - Audio Settings

    var spatialAudioEnabled: Bool = true
    var arSoundEnabled: Bool = true
    var vrSoundEnabled: Bool = true
    var masterVolume: Float = 0.8
    var effectsVolume: Float = 0.7

    // MARK: - Haptics

    var hapticsEnabled: Bool = true

    // MARK: - Continue / Last Palace

    /// ID of the last palace entered. Persisted so the Continue button
    /// works across app launches. Cleared when the user explicitly exits.
    var lastPalaceId: String? {
        get { UserDefaults.standard.string(forKey: "lastPalaceId") }
        set { UserDefaults.standard.set(newValue, forKey: "lastPalaceId") }
    }

    /// When set, PalaceSelectView will automatically enter this palace instead
    /// of waiting for the user to tap a card. Cleared after use.
    var pendingContinuePalaceId: String? = nil

    // MARK: - Refresh Triggers

    /// Increment to signal immersive views to reload palace items.
    var palaceItemRefreshTrigger: Int = 0
}
