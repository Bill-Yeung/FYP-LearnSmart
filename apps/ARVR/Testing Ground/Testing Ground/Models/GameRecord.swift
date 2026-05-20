import Foundation

struct GameRecord: Codable, Identifiable {
    var id: String { scriptId ?? documentHash ?? UUID().uuidString }
    let scriptId: String?
    let title: String?
    let documentName: String?
    let moduleName: String?
    let createdAt: String?
    let documentHash: String?

    enum CodingKeys: String, CodingKey {
        case scriptId = "script_id"
        case title
        case documentName = "document_name"
        case moduleName = "module_name"
        case createdAt = "created_at"
        case documentHash = "document_hash"
    }
}

struct SceneRecord: Codable, Identifiable {
    let sceneId: String
    let act: Int?
    let order: Int?
    let title: String
    let location: String?
    let description: String?
    let charactersPresent: [String]?
    let clues: [String]?
    let questions: [String]?

    var id: String { sceneId }

    enum CodingKeys: String, CodingKey {
        case sceneId = "sceneId"
        case act, order, title, location, description
        case charactersPresent = "charactersPresent"
        case clues, questions
    }
}
