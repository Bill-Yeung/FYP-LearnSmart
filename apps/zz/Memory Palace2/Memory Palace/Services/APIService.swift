import Foundation
import Observation

@MainActor @Observable
class APIService {

    static let shared = APIService()

    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        config.waitsForConnectivity = true
        session = URLSession(configuration: config)
    }

    // MARK: - Auth

    struct LoginResponse: Codable {
        let access_token: String
        let refresh_token: String
        let token_type: String?
    }

    func login(email: String, password: String) async throws -> UserSession {
        let body: [String: Any] = ["email": email, "password": password]
        let data = try await post("/api/auth/login", body: body, auth: false)
        let tokens = try JSONDecoder().decode(LoginResponse.self, from: data)

        KeychainService.save(tokens.access_token, forKey: "access_token")
        KeychainService.save(tokens.refresh_token, forKey: "refresh_token")

        let profile = try await getProfile()
        let userSession = UserSession(
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            userId: profile.id,
            email: profile.email,
            displayName: profile.displayName ?? profile.username ?? profile.email,
            role: profile.role
        )
        return userSession
    }

    func register(email: String, password: String, username: String, displayName: String, role: String = "student") async throws -> UserSession {
        let body: [String: Any] = [
            "email": email,
            "password": password,
            "username": username,
            "display_name": displayName,
            "role": role,
        ]
        let data = try await post("/api/auth/register", body: body, auth: false)
        let tokens = try JSONDecoder().decode(LoginResponse.self, from: data)

        KeychainService.save(tokens.access_token, forKey: "access_token")
        KeychainService.save(tokens.refresh_token, forKey: "refresh_token")

        let profile = try await getProfile()
        let userSession = UserSession(
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            userId: profile.id,
            email: profile.email,
            displayName: profile.displayName ?? profile.username ?? profile.email,
            role: profile.role
        )
        return userSession
    }

    func refreshToken() async throws {
        guard let refresh = KeychainService.get(forKey: "refresh_token") else {
            throw APIError.unauthorized
        }
        let body: [String: Any] = ["refresh_token": refresh]
        let data = try await post("/api/auth/refresh", body: body, auth: false)
        let tokens = try JSONDecoder().decode(LoginResponse.self, from: data)
        KeychainService.save(tokens.access_token, forKey: "access_token")
        KeychainService.save(tokens.refresh_token, forKey: "refresh_token")
    }

    func logout() {
        KeychainService.clear()
    }

    // MARK: - Profile

    struct ProfileResponse: Codable {
        let id: String
        let username: String?
        let email: String
        let role: String
        let displayName: String?
        let isActive: Bool?

        enum CodingKeys: String, CodingKey {
            case id, username, email, role
            case displayName = "display_name"
            case isActive = "is_active"
        }
    }

    func getProfile() async throws -> ProfileResponse {
        let data = try await get("/api/users/me")
        return try decode(ProfileResponse.self, from: data)
    }

    func getBadges() async throws -> [Badge] {
        let data = try await get("/api/gamification/badges")
        return try decode([Badge].self, from: data)
    }

    func getReputation() async throws -> Reputation {
        let data = try await get("/api/reputation/me")
        return try decode(Reputation.self, from: data)
    }

    func getPoints() async throws -> Points {
        let data = try await get("/api/gamification/points/summary")
        return try decode(Points.self, from: data)
    }

    // MARK: - Palaces

    struct PalaceListResponse: Codable {
        let palaces: [MemoryPalace]
        let total: Int
    }

    func listPalaces(mode: String? = nil) async throws -> [MemoryPalace] {
        var path = "/api/palaces"
        if let mode { path += "?mode=\(mode)" }
        let data = try await get(path)
        let response = try decode(PalaceListResponse.self, from: data)
        return response.palaces
    }

    func createPalace(name: String, description: String?, mode: String, skyboxType: String, skyboxPreset: String?) async throws -> MemoryPalace {
        var body: [String: Any] = ["name": name, "skybox_type": skyboxType, "mode": mode]
        if let d = description { body["description"] = d }
        if let p = skyboxPreset { body["skybox_preset"] = p }
        let data = try await post("/api/palaces", body: body)
        return try decode(MemoryPalace.self, from: data)
    }

    func deletePalace(palaceId: String) async throws {
        _ = try await delete("/api/palaces/\(palaceId)")
    }

    func openPalace(palaceId: String) async throws -> MemoryPalace {
        let data = try await post("/api/palaces/\(palaceId)/open", body: [:])
        return try decode(MemoryPalace.self, from: data)
    }

    func seedDemoPalaces() async throws -> [MemoryPalace] {
        let data = try await post("/api/palaces/seed-demo", body: [:])
        let response = try decode(PalaceListResponse.self, from: data)
        return response.palaces
    }

    func getPalaceItems(palaceId: String) async throws -> [PalaceItem] {
        let data = try await get("/api/palaces/\(palaceId)/items")
        return try decode([PalaceItem].self, from: data)
    }

    func placeItem(palaceId: String, item: PalaceItemCreate) async throws -> PalaceItem {
        let body = try asDictionary(item)
        let data = try await post("/api/palaces/\(palaceId)/items", body: body)
        return try decode(PalaceItem.self, from: data)
    }

    func updateItemPosition(palaceId: String, itemId: String, x: Float, y: Float, z: Float) async throws -> PalaceItem {
        let body: [String: Any] = ["position_x": x, "position_y": y, "position_z": z]
        let data = try await put("/api/palaces/\(palaceId)/items/\(itemId)", body: body)
        return try decode(PalaceItem.self, from: data)
    }

    func deleteItem(palaceId: String, itemId: String) async throws {
        _ = try await delete("/api/palaces/\(palaceId)/items/\(itemId)")
    }

    func getReviewItems(palaceId: String) async throws -> [PalaceItem] {
        let data = try await get("/api/palaces/\(palaceId)/review")
        return try decode([PalaceItem].self, from: data)
    }

    func submitReview(palaceId: String, itemId: String, quality: Int) async throws {
        let body: [String: Any] = ["quality": quality]
        _ = try await post("/api/palaces/\(palaceId)/review/\(itemId)", body: body)
    }

    // MARK: - Assets (3D Models)

    func listModels(search: String? = nil, page: Int = 1, pageSize: Int = 50) async throws -> AssetListResponse {
        var path = "/api/models?page=\(page)&page_size=\(pageSize)&asset_type=model"
        if let q = search, !q.isEmpty {
            path += "&search=\(q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? q)"
        }
        let data = try await get(path)
        return try decode(AssetListResponse.self, from: data)
    }

    func downloadUSDZURL(assetId: String) -> URL? {
        URL(string: "\(BackendConfig.apiURL)/models/\(assetId)/download/usdz")
    }

    func thumbnailURL(assetId: String) -> URL? {
        URL(string: "\(BackendConfig.apiURL)/models/\(assetId)/thumbnail")
    }

    // MARK: - Flashcards

    func getReviewCards() async throws -> [Flashcard] {
        let data = try await get("/api/flashcards/review")
        if let cards = try? decode([Flashcard].self, from: data) { return cards }
        struct Wrapped: Codable { let cards: [Flashcard]?; let flashcards: [Flashcard]?; let data: [Flashcard]? }
        if let w = try? decode(Wrapped.self, from: data) { return w.cards ?? w.flashcards ?? w.data ?? [] }
        return []
    }

    struct CreatedFlashcard: Codable {
        let id: String
        let front: String
        let back: String
    }

    func createFlashcard(front: String, back: String, topic: String? = nil, tips: String? = nil) async throws -> CreatedFlashcard {
        var body: [String: Any] = ["front": front, "back": back, "card_type": "standard", "auto_generate_tags": false]
        if let t = topic, !t.isEmpty { body["topic"] = t }
        if let h = tips, !h.isEmpty { body["tips"] = h }
        let data = try await post("/api/flashcards/create", body: body)
        return try decode(CreatedFlashcard.self, from: data)
    }

    // MARK: - Records

    func getGameRecords(page: Int = 1) async throws -> [GameRecord] {
        let data = try await get("/api/game/scripts?page=\(page)&page_size=20")
        // May be wrapped in items/scripts key
        if let records = try? decode([GameRecord].self, from: data) { return records }
        struct Wrapped: Codable { let items: [GameRecord]? ; let scripts: [GameRecord]? }
        if let w = try? decode(Wrapped.self, from: data) { return w.items ?? w.scripts ?? [] }
        return []
    }

    func getActivityFeed(page: Int = 1) async throws -> [ActivityRecord] {
        let data = try await get("/api/activity-feed?page=\(page)&page_size=20")
        if let records = try? decode([ActivityRecord].self, from: data) { return records }
        struct Wrapped: Codable { let items: [ActivityRecord] }
        if let w = try? decode(Wrapped.self, from: data) { return w.items }
        return []
    }

    func getReviewHistory(page: Int = 1, pageSize: Int = 30) async throws -> ReviewHistoryResponse {
        let data = try await get("/api/flashcards/review-history?page=\(page)&page_size=\(pageSize)")
        return try decode(ReviewHistoryResponse.self, from: data)
    }

    // MARK: - Health

    func testConnection() async -> Bool {
        do {
            _ = try await get("/health", auth: false)
            return true
        } catch {
            return false
        }
    }

    // MARK: - HTTP Helpers

    enum APIError: LocalizedError {
        case unauthorized
        case serverError(Int, String)
        case networkError(String)
        case decodingError(String)

        var errorDescription: String? {
            switch self {
            case .unauthorized: return "Session expired. Please log in again."
            case .serverError(let code, let msg): return "Server error (\(code)): \(msg)"
            case .networkError(let msg): return "Network error: \(msg)"
            case .decodingError(let msg): return "Data error: \(msg)"
            }
        }
    }

    private func get(_ path: String, auth: Bool = true) async throws -> Data {
        try await request(path, method: "GET", auth: auth)
    }

    private func post(_ path: String, body: [String: Any], auth: Bool = true) async throws -> Data {
        try await request(path, method: "POST", body: body, auth: auth)
    }

    private func put(_ path: String, body: [String: Any], auth: Bool = true) async throws -> Data {
        try await request(path, method: "PUT", body: body, auth: auth)
    }

    private func delete(_ path: String, auth: Bool = true) async throws -> Data {
        try await request(path, method: "DELETE", auth: auth)
    }

    private func request(_ path: String, method: String, body: [String: Any]? = nil, auth: Bool = true, isRetry: Bool = false) async throws -> Data {
        guard let url = URL(string: "\(BackendConfig.baseURL)\(path)") else {
            throw APIError.networkError("Invalid URL: \(path)")
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if auth, let token = KeychainService.get(forKey: "access_token") {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.networkError(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.networkError("Invalid response")
        }

        // Auto-refresh on 401
        if http.statusCode == 401 && auth && !isRetry {
            do {
                try await refreshToken()
                return try await request(path, method: method, body: body, auth: auth, isRetry: true)
            } catch {
                throw APIError.unauthorized
            }
        }

        guard (200...299).contains(http.statusCode) else {
            let detail = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["detail"] as? String ?? "Unknown error"
            throw APIError.serverError(http.statusCode, detail)
        }

        return data
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let str = try container.decode(String.self)
            let formatters: [ISO8601DateFormatter] = {
                let f1 = ISO8601DateFormatter()
                f1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                let f2 = ISO8601DateFormatter()
                f2.formatOptions = [.withInternetDateTime]
                return [f1, f2]
            }()
            for fmt in formatters {
                if let date = fmt.date(from: str) { return date }
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date: \(str)")
        }
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw APIError.decodingError(error.localizedDescription)
        }
    }

    private func asDictionary<T: Encodable>(_ value: T) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }
        return dict
    }
}
