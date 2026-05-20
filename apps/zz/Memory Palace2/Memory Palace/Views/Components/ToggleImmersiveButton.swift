import SwiftUI

/// AR | VR segmented toggle for the navigation toolbar.
/// Locked when user is inside an immersive space.
struct ModeToggle: View {

    @Environment(AppModel.self) private var appModel

    var body: some View {
        @Bindable var model = appModel
        let transitioning = appModel.immersiveSpaceState == .inTransition
        let locked = appModel.isInsidePalace

        Picker("Mode", selection: $model.immersionMode) {
            Text("AR").tag(AppModel.ImmersionMode.ar)
            Text("VR").tag(AppModel.ImmersionMode.vr)
        }
        .pickerStyle(.segmented)
        .frame(width: 200)
        .disabled(transitioning || locked)
        .opacity(transitioning || locked ? 0.5 : 1)
    }
}

/// "Exit Palace" button shown when immersed.
struct ExitPalaceButton: View {

    @Environment(AppModel.self) private var appModel
    #if os(visionOS)
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    #endif

    var body: some View {
        if appModel.immersiveSpaceState == .open {
            Button {
                Task { @MainActor in
                    appModel.immersiveSpaceState = .inTransition
                    appModel.currentPalace = nil
                    #if os(visionOS)
                    await dismissImmersiveSpace()
                    #endif
                }
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
            }
            .buttonStyle(.bordered)
            .tint(.red)
        }
    }
}

/// Global toolbar: logo (left), title (center), toggle + logout (right).
/// Visible on every screen inside the NavigationStack.
extension View {
    func withAppToolbar(title: String? = nil) -> some View {
        self
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if title == nil {
                    ToolbarItem(placement: .topBarLeading) {
                        LearnSmartHeader(size: .small)
                    }
                }
                if let title {
                    ToolbarItem(placement: .principal) {
                        Text(title)
                            .font(.title3)
                            .fontWeight(.semibold)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    LogoutButton()
                }
            }
    }
}

/// Toolbar logout button.
struct LogoutButton: View {

    @Environment(AuthViewModel.self) private var authVM
    @Environment(AppModel.self) private var appModel

    var body: some View {
        Button {
            appModel.immersionMode = .ar
            appModel.currentPalace = nil
            authVM.logout()
        } label: {
            Image(systemName: "rectangle.portrait.and.arrow.right")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
        .buttonStyle(.plain)
    }
}
