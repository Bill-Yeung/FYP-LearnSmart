import Foundation

struct MemoryPalace: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    let name: String
    let description: String?
    let mode: String
    let skyboxType: String
    let skyboxPreset: String?
    let skyboxImagePath: String?
    let isActive: Bool
    let lastOpenedAt: Date?
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name, description, mode
        case userId = "user_id"
        case skyboxType = "skybox_type"
        case skyboxPreset = "skybox_preset"
        case skyboxImagePath = "skybox_image_path"
        case isActive = "is_active"
        case lastOpenedAt = "last_opened_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var isAR: Bool { mode == "ar" }
    var isVR: Bool { mode == "vr" }
}
