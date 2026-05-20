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

    // MARK: - Live Scene Override
    // Set from ObjectLibraryView → Scenes tab to hot-swap the skybox without re-creating the palace.
    var activeSceneURL: String?       // HDRI thumbnail URL (takes priority)
    var activeScenePreset: String?    // Built-in preset name (fallback)

    // MARK: - Audio Settings

    var spatialAudioEnabled: Bool = true
    var arSoundEnabled: Bool = true
    var vrSoundEnabled: Bool = true
    var masterVolume: Float = 0.8
    var effectsVolume: Float = 0.7

    // MARK: - Haptics

    var hapticsEnabled: Bool = true
}
