import Foundation

struct GameRecord: Codable, Identifiable {
    var id: String { scriptId }
    let scriptId: String
    let scriptTitle: String?
    let scriptSummary: String?
    let generationMethod: String?
    let estimatedDuration: Int?
    let validationStatus: String?
    let playCount: Int?
    let generatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case scriptTitle = "script_title"
        case scriptId = "script_id"
        case scriptSummary = "script_summary"
        case generationMethod = "generation_method"
        case estimatedDuration = "estimated_duration"
        case validationStatus = "validation_status"
        case playCount = "play_count"
        case generatedAt = "generated_at"
    }
}
