import Foundation

struct Badge: Codable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let iconUrl: String?
    let color: String?
    let rarity: String?
    let badgeType: String?
    let earned: Bool?
    let earnedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description, color, rarity, earned
        case iconUrl = "icon_url"
        case badgeType = "badge_type"
        case earnedAt = "earned_at"
    }
}
