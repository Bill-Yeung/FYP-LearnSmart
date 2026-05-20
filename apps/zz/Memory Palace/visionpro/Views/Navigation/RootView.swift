import SwiftUI

struct RootView: View {

    @Environment(AppModel.self) private var appModel
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @State private var authVM = AuthViewModel()
    @State private var navigationPath = NavigationPath()

    var body: some View {
        Group {
            if authVM.isAuthenticated {
                NavigationStack(path: $navigationPath) {
                    HomeView()
                        .withAppToolbar()
                        .navigationDestination(for: AppRoute.self) { route in
                            switch route {
                            case .home:
                                HomeView().withAppToolbar()
                            case .palace, .palaceSelect:
                                PalaceSelectView().withAppToolbar(title: "Memory Palaces")
                            case .palaceContent(let palaceId):
                                PalaceContentView(palaceId: palaceId)
                            case .profile:
                                ProfileView().withAppToolbar(title: "Profile")
                            case .records:
                                RecordsView().withAppToolbar(title: "Records")
                            case .library:
                                ObjectLibraryView().withAppToolbar(title: "Library")
                            case .settings:
                                SettingsView().withAppToolbar(title: "Settings")
                            }
                        }
                }
            } else {
                LoginView()
            }
        }
        .overlay {
            if appModel.immersiveSpaceState == .inTransition {
                ZStack {
                    Color.black.opacity(0.4)
                        .ignoresSafeArea()
                    VStack(spacing: 12) {
                        ProgressView()
                            .controlSize(.large)
                        Text("Switching to \(appModel.immersionMode == .vr ? "VR" : "AR")…")
                            .font(.headline)
                    }
                    .padding(24)
                    .glassBackgroundEffect()
                    .cornerRadius(16)
                }
            }
        }
        .environment(authVM)
        .onChange(of: authVM.isAuthenticated) { _, isAuth in
            if !isAuth {
                navigationPath = NavigationPath()
                Task {
                    if appModel.immersiveSpaceState == .open {
                        await dismissImmersiveSpace()
                    }
                }
            }
        }
        .task {
            await authVM.restoreSession()
        }
    }
}
