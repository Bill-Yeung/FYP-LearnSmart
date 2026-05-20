import Foundation

struct Points: Codable {
    let totalBalance: Int?
    let currentStreak: Int?
    let longestStreak: Int?

    enum CodingKeys: String, CodingKey {
        case totalBalance = "total_balance"
        case currentStreak = "current_streak"
        case longestStreak = "longest_streak"
    }
}
