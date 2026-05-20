//
//  HomeView.swift
//  Testing Ground
//
//  Created by ituser on 29/1/2026.
//

import SwiftUI

struct HomeView: View {
    let canContinue: Bool
    let onStartNew: () -> Void
    let onContinue: () -> Void
    let onProfile: () -> Void
    let onRecords: () -> Void
    let onUploads: () -> Void
    let onSettings: () -> Void
    let onLogout: () -> Void

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(white: 0.95),
                    Color(white: 0.92)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 20) {
                header

                // Main Actions
                HStack(spacing: 12) {
                    ActionCard(
                        title: "Start",
                        subtitle: "New session",
                        systemImage: "play.fill",
                        prominence: .primary,
                        tint: .blue,
                        action: onStartNew
                    )

                    ActionCard(
                        title: "Continue",
                        subtitle: canContinue ? "Resume" : "None",
                        systemImage: "arrow.clockwise",
                        prominence: canContinue ? .secondary : .disabled,
                        tint: .indigo,
                        action: onContinue
                    )
                    .disabled(!canContinue)
                }

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
                        title: "Records",
                        subtitle: "Progress",
                        systemImage: "chart.line.uptrend.xyaxis",
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
