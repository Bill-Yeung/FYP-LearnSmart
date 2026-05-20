import SwiftUI

// MARK: - LearnSmart Brand Colors

/// Brand color constants matching the web app.
enum Brand {
    /// Primary blue — matches web blue-600 (#2563EB)
    static let primary = Color(red: 0.145, green: 0.388, blue: 0.922)
    /// Secondary purple — matches web purple-600 (#9333EA)
    static let secondary = Color(red: 0.576, green: 0.200, blue: 0.918)
    /// Accent cyan — matches web cyan-500 (#06B6D4)
    static let accent = Color(red: 0.024, green: 0.714, blue: 0.831)
    /// Pink accent — matches web pink-500 (#EC4899)
    static let pink = Color(red: 0.925, green: 0.282, blue: 0.600)

    /// Card accent colors for different sections
    static let palaceColor = primary
    static let libraryColor = secondary
    static let profileColor = pink
    static let recordsColor = accent
    static let settingsColor = Color(red: 0.400, green: 0.400, blue: 0.450)

    /// Hero gradient: blue → purple → pink (matches web landing page)
    static let heroGradient = LinearGradient(
        colors: [primary, secondary, pink],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    /// Subtle background gradient
    static let backgroundGradient = LinearGradient(
        colors: [
            primary.opacity(0.08),
            secondary.opacity(0.05),
            Color.clear,
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}
