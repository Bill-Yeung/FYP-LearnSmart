import Foundation

struct ConceptItem: Codable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let conceptType: String?
    let difficultyLevel: String?
    let keywords: [String]?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case conceptType = "concept_type"
        case difficultyLevel = "difficulty_level"
        case keywords
    }
}

struct ConceptListResponse: Codable {
    let concepts: [ConceptItem]
    let total: Int
}
