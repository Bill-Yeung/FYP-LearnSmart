//
//  HomeView.swift
//  Testing Ground
//
//  Created by ituser on 29/1/2026.
//

import SwiftUI

struct HomeView: View {
    let onEnterPalace: () -> Void
    let onProfile: () -> Void
    let onRecords: () -> Void
    let onUploads: () -> Void
    let onSettings: () -> Void
    let onLogout: () -> Void

    var body: some View {
        ZStack {
            Brand.backgroundGradient
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 20) {
                header

                ActionCard(
                    title: "Enter Palace",
                    subtitle: "Open or create",
                    systemImage: "building.columns.fill",
                    prominence: .primary,
                    tint: .blue,
                    action: onEnterPalace
                )

                // Secondary Actions
                HStack(spacing: 12) {
                    ActionCard(
                        title: "Profile",
                        subtitle: "Info",
                        systemImage: "person.circle",
                        prominence: .tertiary,
                        tint: .pink,
                        action: onProfile
                    )

                    ActionCard(
                        title: "Review",
                        subtitle: "Progress",
                        systemImage: "checklist.checked",
                        prominence: .tertiary,
                        tint: .purple,
                        action: onRecords
                    )

                    ActionCard(
                        title: "Settings",
                        subtitle: "Options",
                        systemImage: "gearshape.fill",
                        prominence: .tertiary,
                        tint: .orange,
                        action: onSettings
                    )
                }

                Spacer()
            }
            .padding(20)
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            LearnSmartHeader(size: .medium)

            Spacer()

            Button(action: onLogout) {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.red)
            }
        }
    }
}
