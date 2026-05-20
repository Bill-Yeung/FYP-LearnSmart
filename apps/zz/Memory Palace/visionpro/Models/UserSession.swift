import Foundation

struct UserSession: Codable {
    let accessToken: String
    let refreshToken: String
    let userId: String
    let email: String
    let displayName: String
    let role: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case userId = "user_id"
        case email
        case displayName = "display_name"
        case role
    }
}
