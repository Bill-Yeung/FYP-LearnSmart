import SwiftUI

// MARK: - LearnSmart Brand Colors

/// Brand color constants matching the web app.
enum Brand {
    /// Primary blue (#3B82F6)
    static let primary = Color(red: 0.231, green: 0.510, blue: 0.965)
    /// Secondary violet (#8B5CF6)
    static let secondary = Color(red: 0.545, green: 0.361, blue: 0.965)
    /// Accent emerald (#10B981)
    static let accent = Color(red: 0.063, green: 0.725, blue: 0.506)
    /// Pink accent (#EC4899)
    static let pink = Color(red: 0.925, green: 0.282, blue: 0.600)

    /// Card accent colors for different sections
    static let palaceColor = primary
    static let libraryColor = secondary
    static let profileColor = pink
    static let recordsColor = Color(red: 0.925, green: 0.282, blue: 0.282)
    static let settingsColor = Color(red: 0.400, green: 0.400, blue: 0.450)

    /// Hero gradient: blue → purple → pink
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
