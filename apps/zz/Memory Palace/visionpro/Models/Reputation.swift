import Foundation

struct Reputation: Codable {
    let totalScore: Double?
    let level: Int?
    let levelName: String?
    let nextLevelName: String?
    let pointsToNext: Int?
    let rankPercentile: Double?

    enum CodingKeys: String, CodingKey {
        case level
        case totalScore = "total_score"
        case levelName = "level_name"
        case nextLevelName = "next_level_name"
        case pointsToNext = "points_to_next"
        case rankPercentile = "rank_percentile"
    }
}
