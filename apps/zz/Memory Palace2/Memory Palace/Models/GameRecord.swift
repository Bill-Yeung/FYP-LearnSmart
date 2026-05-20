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
