//
//  ActionCard.swift
//  Testing Ground
//
//  Created by youstube on 29/1/2026.
//

import SwiftUI

enum CardProminence {
    case primary
    case secondary
    case tertiary
    case disabled
}

struct ActionCard: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let prominence: CardProminence
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                icon

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(prominence == .disabled ? .secondary : .primary)

                    Text(subtitle)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .padding(18)
            .frame(maxWidth: .infinity, minHeight: prominence == .primary ? 120 : 96)
            .background(background)
            .overlay(border)
        }
        .buttonStyle(.plain)
        .opacity(prominence == .disabled ? 0.55 : 1.0)
    }

    private var icon: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(tint.opacity(prominence == .primary ? 0.35 : 0.22))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .opacity(0.7)
                )
                .frame(width: 54, height: 54)
                .shadow(radius: 8, y: 3)

            Image(systemName: systemImage)
                .font(.system(size: 22, weight: .semibold))
                .symbolRenderingMode(.palette)
                .foregroundStyle(.white, tint.opacity(0.85))
        }
    }

    private var background: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(.thinMaterial)

            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(tint.opacity(prominence == .primary ? 0.22 : 0.10))
        }
    }

    private var border: some View {
        RoundedRectangle(cornerRadius: 22, style: .continuous)
            .strokeBorder(
                prominence == .primary
                ? tint.opacity(0.45)
                : Color.primary.opacity(0.12),
                lineWidth: prominence == .primary ? 1.5 : 1
            )
    }
}
