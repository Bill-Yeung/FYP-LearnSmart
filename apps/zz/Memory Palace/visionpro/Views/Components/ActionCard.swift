import SwiftUI

struct ActionCard: View {

    let icon: String
    let title: String
    let subtitle: String
    var accentColor: Color = Brand.primary

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.largeTitle)
                .foregroundStyle(accentColor)
                .frame(width: 48, height: 48)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 80, alignment: .leading)
        .background(Color.white.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .hoverEffect(.highlight)
        .contentShape(.hoverEffect, RoundedRectangle(cornerRadius: 8))
        .hoverEffectDisabled(false)
    }
}
