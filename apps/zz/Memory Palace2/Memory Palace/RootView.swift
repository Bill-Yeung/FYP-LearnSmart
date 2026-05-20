//
//  RootView.swift
//  Testing Ground
//
//  Created by itst on 5/3/2026.
//

import SwiftUI

struct RootView: View {

    @Environment(AppModel.self) private var appModel
    #if os(visionOS)
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    #endif
    @State private var authVM = AuthViewModel()
    @State private var navigationPath = NavigationPath()

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if authVM.isAuthenticated {
                    NavigationStack(path: $navigationPath) {
                        HomeView(
                            canContinue: appModel.lastPalaceId != nil,
                            onStartNew: { navigationPath.append(AppRoute.palace) },
                            onContinue: {
                                appModel.pendingContinuePalaceId = appModel.lastPalaceId
                                navigationPath.append(AppRoute.palace)
                            },
                            onProfile: { navigationPath.append(AppRoute.profile) },
                            onRecords: { navigationPath.append(AppRoute.records) },
                            onUploads: { navigationPath.append(AppRoute.library) },
                            onSettings: { navigationPath.append(AppRoute.settings) },
                            onLogout: { authVM.logout() }
                        )
                        .navigationDestination(for: AppRoute.self) { route in
                            switch route {
                            case .home:
                                HomeView(
                                    canContinue: appModel.lastPalaceId != nil,
                                    onStartNew: { navigationPath.append(AppRoute.palace) },
                                    onContinue: {
                                        appModel.pendingContinuePalaceId = appModel.lastPalaceId
                                        navigationPath.append(AppRoute.palace)
                                    },
                                    onProfile: { navigationPath.append(AppRoute.profile) },
                                    onRecords: { navigationPath.append(AppRoute.records) },
                                    onUploads: { navigationPath.append(AppRoute.library) },
                                    onSettings: { navigationPath.append(AppRoute.settings) },
                                    onLogout: { authVM.logout() }
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
                    #if os(visionOS)
                    if appModel.immersiveSpaceState == .open {
                        await dismissImmersiveSpace()
                    }
                    #endif
                }
            }
        }
        .task {
            await authVM.restoreSession()
        }
    }
}

#Preview {
    RootView()
        .environment(AppModel())
}
