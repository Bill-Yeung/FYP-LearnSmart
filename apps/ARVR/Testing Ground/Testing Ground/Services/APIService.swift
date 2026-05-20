import Foundation
import Observation

@MainActor @Observable
class APIService {

    static let shared = APIService()
    static let sessionExpiredNotification = Notification.Name("APIServiceSessionExpiredNotification")
    private static let dotenv: [String: String] = APIService.loadDotEnv()

    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 120
        config.timeoutIntervalForResource = 300
        config.waitsForConnectivity = true
        config.allowsExpensiveNetworkAccess = true
        config.allowsConstrainedNetworkAccess = true
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
        struct BadgesWrapper: Decodable { let badges: [Badge] }
        let data = try await get("/api/gamification/badges")
        return try decode(BadgesWrapper.self, from: data).badges
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

    func updatePalace(
        id: String,
        name: String? = nil,
        description: String? = nil,
        skyboxType: String? = nil,
        skyboxPreset: String? = nil,
        skyboxImagePath: String? = nil
    ) async throws -> MemoryPalace {
        var body: [String: Any] = [:]
        if let name { body["name"] = name }
        if let d = description { body["description"] = d }
        if let skyboxType { body["skybox_type"] = skyboxType }
        if let skyboxPreset { body["skybox_preset"] = skyboxPreset }
        if let skyboxImagePath { body["skybox_image_path"] = skyboxImagePath }
        let data = try await put("/api/palaces/\(id)", body: body)
        return try decode(MemoryPalace.self, from: data)
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

    func updateItemMemoryText(palaceId: String, itemId: String, customText: String, label: String? = nil) async throws -> PalaceItem {
        var body: [String: Any] = ["custom_text": customText]
        if let label, !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            body["label"] = label
        }
        let data = try await put("/api/palaces/\(palaceId)/items/\(itemId)", body: body)
        return try decode(PalaceItem.self, from: data)
    }

    func updateItemLabel(palaceId: String, itemId: String, label: String) async throws -> PalaceItem {
        let body: [String: Any] = ["label": label]
        let data = try await put("/api/palaces/\(palaceId)/items/\(itemId)", body: body)
        return try decode(PalaceItem.self, from: data)
    }

    func updateItemFlashcard(palaceId: String, itemId: String, flashcardId: String, customText: String, label: String? = nil) async throws -> PalaceItem {
        var body: [String: Any] = ["flashcard_id": flashcardId, "custom_text": customText]
        if let label { body["label"] = label }
        let data = try await put("/api/palaces/\(palaceId)/items/\(itemId)", body: body)
        return try decode(PalaceItem.self, from: data)
    }

    func updateItemConcept(palaceId: String, itemId: String, conceptId: String, customText: String, label: String? = nil) async throws -> PalaceItem {
        var body: [String: Any] = ["concept_id": conceptId, "custom_text": customText]
        if let label { body["label"] = label }
        let data = try await put("/api/palaces/\(palaceId)/items/\(itemId)", body: body)
        return try decode(PalaceItem.self, from: data)
    }

    func getConcepts() async throws -> [ConceptItem] {
        let data = try await get("/api/documents/concepts/all")
        let response = try decode(ConceptListResponse.self, from: data)
        return response.concepts
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
        // Backend may return array directly or wrapped
        if let cards = try? decode([Flashcard].self, from: data) {
            return cards
        }
        struct Wrapped: Codable { let flashcards: [Flashcard] }
        if let wrapped = try? decode(Wrapped.self, from: data) {
            return wrapped.flashcards
        }
        return []
    }

    // MARK: - Records

    func getScenes(scriptId: String) async throws -> [SceneRecord] {
        let path = "/api/game/scenes?scriptId=\(scriptId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? scriptId)"
        let data = try await get(path)
        if let scenes = try? decode([SceneRecord].self, from: data) { return scenes }
        struct Wrapped: Codable { let scenes: [SceneRecord] }
        if let w = try? decode(Wrapped.self, from: data) { return w.scenes }
        return []
    }

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

        applyCloudflareAccessHeaders(to: &req)

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
                NotificationCenter.default.post(name: Self.sessionExpiredNotification, object: nil)
                throw APIError.unauthorized
            }
        }

        guard (200...299).contains(http.statusCode) else {
            let detail = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["detail"] as? String ?? "Unknown error"
            throw APIError.serverError(http.statusCode, detail)
        }

        // Detect HTML response (e.g. Cloudflare error page or server gateway error)
        if let prefix = String(data: data.prefix(100), encoding: .utf8), prefix.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("<") {
            throw APIError.networkError("Server returned an error page instead of JSON. The server may be down or unreachable.")
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

    // MARK: - Cloudflare Access

    func applyCloudflareAccessHeaders(to request: inout URLRequest) {
        let clientID     = configValue(for: ["CF_ACCESS_CLIENT_ID", "CF-Access-Client-Id"])
        let clientSecret = configValue(for: ["CF_ACCESS_CLIENT_SECRET", "CF-Access-Client-Secret"])

        if let id = clientID     { request.setValue(id,     forHTTPHeaderField: "CF-Access-Client-Id") }
        if let secret = clientSecret { request.setValue(secret, forHTTPHeaderField: "CF-Access-Client-Secret") }
    }

    private func configValue(for keys: [String]) -> String? {
        for key in keys {
            if let value = ProcessInfo.processInfo.environment[key]?.trimmingCharacters(in: .whitespacesAndNewlines),
               !value.isEmpty { return value }
            if let value = Self.dotenv[key]?.trimmingCharacters(in: .whitespacesAndNewlines),
               !value.isEmpty { return value }
            // Fallback: read from Info.plist (works on physical devices where .env is unavailable)
            if let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
               !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return value }
        }
        return nil
    }

    private static func loadDotEnv() -> [String: String] {
        let candidateURLs: [URL?] = [
            URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .appendingPathComponent(".env"),
            Bundle.main.resourceURL?.appendingPathComponent(".env"),
        ]
        for candidateURL in candidateURLs {
            guard let url = candidateURL,
                  let contents = try? String(contentsOf: url, encoding: .utf8) else { continue }
            var values: [String: String] = [:]
            for rawLine in contents.components(separatedBy: .newlines) {
                let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
                if line.isEmpty || line.hasPrefix("#") { continue }
                let parts = line.split(separator: "=", maxSplits: 1).map(String.init)
                guard parts.count == 2 else { continue }
                let key = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
                var val = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
                if (val.hasPrefix("\"") && val.hasSuffix("\"")) ||
                   (val.hasPrefix("'") && val.hasSuffix("'")) {
                    val = String(val.dropFirst().dropLast())
                }
                values[key] = val
            }
            if !values.isEmpty { return values }
        }
        return [:]
    }

    // MARK: - Vision Pro Scene Assets

    struct VisionProBackground: Codable, Identifiable {
        let id: String
        let name: String
        let thumbnailUrl: String?
        let hdrUrl: String?
        let exrUrl: String?
        let availableResolutions: [String]
        let categories: [String]

        enum CodingKeys: String, CodingKey {
            case id, name, categories
            case thumbnailUrl = "thumbnail_url"
            case hdrUrl = "hdr_url"
            case exrUrl = "exr_url"
            case availableResolutions = "available_resolutions"
        }
    }

    struct VisionProBackgroundListResponse: Codable {
        let items: [VisionProBackground]
        let total: Int
        let page: Int
        let pageSize: Int

        enum CodingKeys: String, CodingKey {
            case items, total, page
            case pageSize = "page_size"
        }
    }

    func listSceneBackgrounds(search: String? = nil, page: Int = 1, pageSize: Int = 20) async throws -> VisionProBackgroundListResponse {
        var path = "/api/visionpro/scene/backgrounds?page=\(page)&page_size=\(pageSize)"
        if let q = search, !q.isEmpty {
            path += "&search=\(q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? q)"
        }
        let data = try await get(path)
        return try decode(VisionProBackgroundListResponse.self, from: data)
    }

    // MARK: - AI Helper

    struct AIAskResponse: Codable {
        let answer: String
    }

    func askAI(modelName: String, question: String, context: String? = nil) async throws -> String {
        let body: [String: Any] = ["model_name": modelName, "question": question]
        var requestBody = body
        if let context, !context.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            requestBody["context"] = context
        }
        let data = try await post("/api/visionpro/ai/ask", body: requestBody)
        return try decode(AIAskResponse.self, from: data).answer
    }

    struct PalaceSuggestMemoryItem: Codable {
        let id: String
        let type: String
        let title: String
        let content: String
    }

    struct PalaceObjectSuggestion: Codable, Identifiable {
        let memoryItemId: String
        let memoryItemType: String
        let assetId: String
        let objectLabel: String
        let memoryText: String
        let reason: String?

        var id: String { memoryItemId }

        enum CodingKeys: String, CodingKey {
            case memoryItemId = "memory_item_id"
            case memoryItemType = "memory_item_type"
            case assetId = "asset_id"
            case objectLabel = "object_label"
            case memoryText = "memory_text"
            case reason
        }
    }

    private struct PalaceSuggestResponse: Codable {
        let suggestions: [PalaceObjectSuggestion]
    }

    func suggestPalaceObjects(theme: String, memoryItems: [PalaceSuggestMemoryItem]) async throws -> [PalaceObjectSuggestion] {
        let body: [String: Any] = [
            "theme": theme,
            "memory_items": memoryItems.map {
                [
                    "id": $0.id,
                    "type": $0.type,
                    "title": $0.title,
                    "content": $0.content,
                ]
            },
        ]
        let data = try await post("/api/visionpro/ai/suggest-palace", body: body)
        return try decode(PalaceSuggestResponse.self, from: data).suggestions
    }
}
