//
//  RootView.swift
//  Testing Ground
//
//  Created by itst on 5/3/2026.
//

import SwiftUI

struct RootView: View {

    @Environment(AppModel.self) private var appModel
    @Environment(AuthViewModel.self) private var authVM
    #if os(visionOS)
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @Environment(\.dismissWindow) private var dismissWindow
    #endif
    @State private var navigationPath = NavigationPath()

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if authVM.isAuthenticated {
                    NavigationStack(path: $navigationPath) {
                        HomeView(
                            onEnterPalace: { navigationPath.append(AppRoute.palace) },
                            onProfile: { navigationPath.append(AppRoute.profile) },
                            onRecords: { navigationPath.append(AppRoute.records) },
                            onUploads: { navigationPath.append(AppRoute.library) },
                            onSettings: { navigationPath.append(AppRoute.settings) },
                            onLogout: { Task { await logoutAndClosePalace() } }
                        )
                        .navigationDestination(for: AppRoute.self) { route in
                            switch route {
                            case .home:
                                HomeView(
                                    onEnterPalace: { navigationPath.append(AppRoute.palace) },
                                    onProfile: { navigationPath.append(AppRoute.profile) },
                                    onRecords: { navigationPath.append(AppRoute.records) },
                                    onUploads: { navigationPath.append(AppRoute.library) },
                                    onSettings: { navigationPath.append(AppRoute.settings) },
                                    onLogout: { Task { await logoutAndClosePalace() } }
                                )

                            case .profile:
                                ProfileView()

                            case .records:
                                RecordsView()

                            case .palace, .palaceSelect:
                                PalaceSelectView()

                            case .palaceContent(let palaceId):
                                PalaceContentView(palaceId: palaceId)
                            case .library:
                                ObjectLibraryView()

                            case .settings:
                                SettingsView()

                            case .scriptScenes(let scriptId, let scriptTitle):
                                ScriptScenesView(scriptId: scriptId, scriptTitle: scriptTitle)
                            }
                        }
                    }
                } else {
                    LoginView()
                }
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
                    .glassBackground()
                    .cornerRadius(16)
                }
            }
        }
        .onChange(of: authVM.isAuthenticated) { _, isAuth in
            if !isAuth {
                navigationPath = NavigationPath()
                Task {
                    await closePalaceExperience()
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: APIService.sessionExpiredNotification)) { _ in
            Task {
                await closePalaceExperience()
                authVM.logout()
            }
        }
        .task {
            await authVM.restoreSession()
        }
    }

    @MainActor
    private func logoutAndClosePalace() async {
        await closePalaceExperience()
        authVM.logout()
    }

    @MainActor
    private func closePalaceExperience() async {
        #if os(visionOS)
        if appModel.immersiveSpaceState == .open || appModel.immersiveSpaceState == .inTransition {
            appModel.immersiveSpaceState = .inTransition
            await dismissImmersiveSpace()
        }
        dismissWindow(id: AppModel.LibraryWindowID.models)
        dismissWindow(id: AppModel.LibraryWindowID.concepts)
        dismissWindow(id: AppModel.LibraryWindowID.flashcards)
        dismissWindow(id: AppModel.LibraryWindowID.scenes)
        dismissWindow(id: AppModel.ItemWindowID.detail)
        #endif
        appModel.clearPalaceSession()
        navigationPath = NavigationPath()
    }
}

#Preview {
    RootView()
        .environment(AppModel())
        .environment(AuthViewModel())
}
