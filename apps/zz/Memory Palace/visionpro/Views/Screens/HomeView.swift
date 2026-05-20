import SwiftUI

struct HomeView: View {

    @Environment(AppModel.self) private var appModel
    @Environment(AuthViewModel.self) private var authVM
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Welcome message
                if let user = authVM.currentUser {
                    Text("Welcome back, \(user.displayName)")
                        .font(.title2)
                        .fontWeight(.medium)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 40)
                }

                // Navigation Cards — 2-column grid
                LazyVGrid(columns: [
                    GridItem(.flexible(), spacing: 12),
                    GridItem(.flexible(), spacing: 12),
                ], spacing: 12) {
                    NavigationLink(value: AppRoute.palace) {
                        ActionCard(
                            icon: "building.columns",
                            title: "My Palaces",
                            subtitle: "Memory rooms",
                            accentColor: Brand.palaceColor
                        )
                    }
                    .buttonStyle(.plain)
                    .hoverEffectDisabled()

                    NavigationLink(value: AppRoute.library) {
                        ActionCard(
                            icon: "cube.box",
                            title: "Library",
                            subtitle: "3D Models & Flashcards",
                            accentColor: Brand.libraryColor
                        )
                    }
                    .buttonStyle(.plain)
                    .hoverEffectDisabled()

                    NavigationLink(value: AppRoute.profile) {
                        ActionCard(
                            icon: "person.circle",
                            title: "Profile",
                            subtitle: "Badges & Stats",
                            accentColor: Brand.profileColor
                        )
                    }
                    .buttonStyle(.plain)
                    .hoverEffectDisabled()

                    NavigationLink(value: AppRoute.records) {
                        ActionCard(
                            icon: "chart.bar",
                            title: "Records",
                            subtitle: "Games & Activity",
                            accentColor: Brand.recordsColor
                        )
                    }
                    .buttonStyle(.plain)
                    .hoverEffectDisabled()

                    NavigationLink(value: AppRoute.settings) {
                        ActionCard(
                            icon: "gearshape",
                            title: "Settings",
                            subtitle: "Connection & Audio",
                            accentColor: Brand.settingsColor
                        )
                    }
                    .buttonStyle(.plain)
                    .hoverEffectDisabled()
                }
                .padding(.horizontal, 40)
            }
            .padding(.vertical, 24)
        }
        .onChange(of: appModel.immersionMode) { _, newMode in
            Task {
                switch newMode {
                case .vr:
                    await openImmersive()
                case .ar:
                    await closeImmersive()
                }
            }
        }
    }

    // MARK: - Immersive Space Management

    private func openImmersive() async {
        // Dismiss first if already open (switching from a different style)
        if appModel.immersiveSpaceState == .open {
            appModel.immersiveSpaceState = .inTransition
            await dismissImmersiveSpace()
            try? await Task.sleep(for: .milliseconds(300))
        }
        guard appModel.immersiveSpaceState == .closed else { return }
        appModel.immersiveSpaceState = .inTransition
        let result = await openImmersiveSpace(id: appModel.immersiveSpaceID)
        switch result {
        case .opened:
            break
        case .userCancelled, .error:
            fallthrough
        @unknown default:
            appModel.immersiveSpaceState = .closed
        }
    }

    private func closeImmersive() async {
        guard appModel.immersiveSpaceState == .open else { return }
        appModel.immersiveSpaceState = .inTransition
        await dismissImmersiveSpace()
    }
}
