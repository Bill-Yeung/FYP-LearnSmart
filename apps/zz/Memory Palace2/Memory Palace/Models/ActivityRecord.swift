import Foundation

struct ActivityRecord: Codable, Identifiable {
    let id: String
    let type: String?
    let entityType: String?
    let entityId: String?
    let likes: Int?
    let comments: Int?
    let createdAt: Date?

    // Nested user info
    let user: ActivityUser?
    let content: ActivityContent?

    enum CodingKeys: String, CodingKey {
        case id, type, likes, comments, user, content
        case entityType = "entity_type"
        case entityId = "entity_id"
        case createdAt = "created_at"
    }
}

struct ActivityUser: Codable {
    let id: String?
    let username: String?
    let displayName: String?
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, username
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
    }
}

struct ActivityContent: Codable {
    let title: String?
    let description: String?
    let link: String?
}
