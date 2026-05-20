import SwiftUI

struct GlassBackgroundModifier: ViewModifier {
    var cornerRadius: CGFloat = 12
    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.primary.opacity(0.06))
            )
            .shadow(color: Color.black.opacity(0.12), radius: 8, x: 0, y: 4)
    }
}

struct PalaceAttachmentBackgroundModifier: ViewModifier {
    var cornerRadius: CGFloat = 12

    func body(content: Content) -> some View {
        content
            .background(.regularMaterial)
            .background(Color.black.opacity(0.22))
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.12))
            )
            .shadow(color: Color.black.opacity(0.22), radius: 10, x: 0, y: 5)
    }
}

extension View {
    func glassBackground(cornerRadius: CGFloat = 12) -> some View {
        modifier(GlassBackgroundModifier(cornerRadius: cornerRadius))
    }

    func palaceAttachmentBackground(cornerRadius: CGFloat = 12) -> some View {
        modifier(PalaceAttachmentBackgroundModifier(cornerRadius: cornerRadius))
    }
}
