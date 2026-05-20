import Foundation
import simd

struct PalaceItem: Codable, Identifiable {
    let id: String
    let palaceId: String
    let userId: String
    let memoryItemId: String?
    let positionX: Float
    let positionY: Float
    let positionZ: Float
    let rotationY: Float
    let scale: Float
    let flashcardId: String?
    let assetId: String?
    let customText: String?
    let customImageUrl: String?
    let label: String?
    let displayType: String
    let nextReviewAt: Date?
    let reviewCount: Int
    let easeFactor: Double
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case palaceId = "palace_id"
        case userId = "user_id"
        case memoryItemId = "memory_item_id"
        case positionX = "position_x"
        case positionY = "position_y"
        case positionZ = "position_z"
        case rotationY = "rotation_y"
        case scale
        case flashcardId = "flashcard_id"
        case assetId = "asset_id"
        case customText = "custom_text"
        case customImageUrl = "custom_image_url"
        case label
        case displayType = "display_type"
        case nextReviewAt = "next_review_at"
        case reviewCount = "review_count"
        case easeFactor = "ease_factor"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var position: SIMD3<Float> {
        SIMD3(positionX, positionY, positionZ)
    }
}

struct PalaceItemCreate: Codable {
    var positionX: Float = 0
    var positionY: Float = 1.0
    var positionZ: Float = -1.5
    var rotationY: Float = 0
    var scale: Float = 1.0
    var flashcardId: String?
    var assetId: String?
    var customText: String?
    var customImageUrl: String?
    var label: String?
    var displayType: String = "card"

    enum CodingKeys: String, CodingKey {
        case positionX = "position_x"
        case positionY = "position_y"
        case positionZ = "position_z"
        case rotationY = "rotation_y"
        case scale
        case flashcardId = "flashcard_id"
        case assetId = "asset_id"
        case customText = "custom_text"
        case customImageUrl = "custom_image_url"
        case label
        case displayType = "display_type"
    }
}
