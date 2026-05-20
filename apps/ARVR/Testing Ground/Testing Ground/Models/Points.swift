import Foundation

struct Points: Codable {
    let balance: Int
    let totalEarned: Int
    let totalSpent: Int
    let streak: Streak

    struct Streak: Codable {
        let current: Int
        let longest: Int
        let multiplier: Double
    }

    enum CodingKeys: String, CodingKey {
        case balance
        case totalEarned = "total_earned"
        case totalSpent = "total_spent"
        case streak
    }
}
