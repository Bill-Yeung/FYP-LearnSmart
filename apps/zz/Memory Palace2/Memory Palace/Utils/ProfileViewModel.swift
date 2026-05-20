//
//  ProfileViewModel.swift
//  Testing Ground
//
//  Created by copilot on 28/2/2026.
//

import Foundation
import Combine

// MARK: - Models

struct UserData: Codable {
    let id: String
    let username: String
    let email: String
    let role: String
    let displayName: String
    let isActive: Bool
    let emailVerified: Bool
    let createdAt: String?
    let lastLogin: String?

    enum CodingKeys: String, CodingKey {
        case id, username, email, role
        case displayName = "display_name"
        case isActive = "is_active"
        case emailVerified = "email_verified"
        case createdAt = "created_at"
        case lastLogin = "last_login"
    }
}

struct UserProfileData: Codable {
    let userId: String
    let bio: String?
    let avatarUrl: String?
    let organization: String?
    let department: String?
    let level: String?
    let timezone: String?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case bio
        case avatarUrl = "avatar_url"
        case organization, department, level, timezone
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct PointsSummary: Decodable {
    let balance: Int
    let totalEarned: Int
    let totalSpent: Int
    let pointsByType: [PointTypeTotal]
    let streak: StreakInfo
    let cosmetics: [String: String]

    struct PointTypeTotal: Decodable {
        let name: String
        let urlId: String?
        let icon: String?
        let color: String?
        let total: Int

        enum CodingKeys: String, CodingKey {
            case name, icon, color, total
            case urlId = "url_id"
        }
    }

    struct StreakInfo: Decodable {
        let current: Int
        let longest: Int
        let multiplier: Double
    }

    enum CodingKeys: String, CodingKey {
        case balance
        case totalEarned = "total_earned"
        case totalSpent = "total_spent"
        case pointsByType = "points_by_type"
        case streak, cosmetics
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.balance = (try? container.decode(Int.self, forKey: .balance)) ?? 0
        self.totalEarned = (try? container.decode(Int.self, forKey: .totalEarned)) ?? 0
        self.totalSpent = (try? container.decode(Int.self, forKey: .totalSpent)) ?? 0
        self.pointsByType = (try? container.decode([PointTypeTotal].self, forKey: .pointsByType)) ?? []
        self.streak = (try? container.decode(StreakInfo.self, forKey: .streak)) ?? StreakInfo(current: 0, longest: 0, multiplier: 1.0)
        self.cosmetics = (try? container.decode([String: String].self, forKey: .cosmetics)) ?? [:]
    }
}

struct ReputationInfo: Codable {
    let totalScore: Int
    let level: Int
    let levelName: String
    let nextLevelName: String?
    let pointsToNext: Int
    let rankPercentile: Double

    enum CodingKeys: String, CodingKey {
        case totalScore = "total_score"
        case level
        case levelName = "level_name"
        case nextLevelName = "next_level_name"
        case pointsToNext = "points_to_next"
        case rankPercentile = "rank_percentile"
    }
}

struct ReputationBreakdown: Decodable {
    let dimension: String
    let score: Int
    let percentage: Double

    enum CodingKeys: String, CodingKey {
        case dimension
        case dimensionName = "dimension_name"
        case name
        case score
        case percentage
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let dim = (try? container.decode(String.self, forKey: .dimension))
            ?? (try? container.decode(String.self, forKey: .dimensionName))
            ?? (try? container.decode(String.self, forKey: .name))
        self.dimension = dim ?? "Unknown"
        self.score = (try? container.decode(Int.self, forKey: .score)) ?? 0
        self.percentage = (try? container.decode(Double.self, forKey: .percentage)) ?? 0
    }
}

struct ReputationEvent: Identifiable, Codable {
    let id: String
    let eventType: String
    let dimension: String
    let pointsChange: Int
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case eventType = "event_type"
        case dimension
        case pointsChange = "points_change"
        case createdAt = "created_at"
    }
}

struct PointsTransaction: Identifiable, Codable {
    let id: String
    let points: Int
    let actionType: String
    let description: String?
    let pointTypeName: String?
    let icon: String?
    let color: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, points
        case actionType = "action_type"
        case description
        case pointTypeName = "point_type_name"
        case icon, color
        case createdAt = "created_at"
    }
}

struct BadgesResponse: Codable {
    let badges: [Badge]
}

struct PointsHistoryResponse: Codable {
    let transactions: [PointsTransaction]
    let total: Int
    let page: Int
    let pageSize: Int

    enum CodingKeys: String, CodingKey {
        case transactions, total, page
        case pageSize = "page_size"
    }
}

struct ReputationBreakdownResponse: Decodable {
    let breakdown: [ReputationBreakdown]
}

struct ReputationEventsResponse: Codable {
    let events: [ReputationEvent]
}

// MARK: - View Model

@MainActor
class ProfileViewModel: ObservableObject {
    @Published var userData: UserData?
    @Published var userProfile: UserProfileData?
    @Published var pointsSummary: PointsSummary?
    @Published var badges: [Badge] = []
    @Published var reputationInfo: ReputationInfo?
    @Published var reputationBreakdown: [ReputationBreakdown] = []
    @Published var reputationEvents: [ReputationEvent] = []
    @Published var pointsHistory: [PointsTransaction] = []

    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedTab: ProfileTab = .overview

    private let apiService = ProfileAPIService.shared

    enum ProfileTab: Hashable {
        case overview
        case badges
        case reputation
        case points
    }

    func loadAllProfileData() async {
        isLoading = true
        errorMessage = nil

        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadUserData() }
            group.addTask { await self.loadUserProfile() }
            group.addTask { await self.loadPointsSummary() }
            group.addTask { await self.loadBadges() }
            group.addTask { await self.loadReputationInfo() }
        }

        isLoading = false
    }

    func loadUserData() async {
        do {
            let user = try await apiService.fetchUserData()
            self.userData = user
        } catch {
            self.errorMessage = "Failed to load user data: \(error.localizedDescription)"
        }
    }

    func loadUserProfile() async {
        do {
            let profile = try await apiService.fetchUserProfile()
            self.userProfile = profile
        } catch {
            self.errorMessage = "Failed to load profile: \(error.localizedDescription)"
        }
    }

    func loadPointsSummary() async {
        do {
            let summary = try await apiService.fetchPointsSummary()
            self.pointsSummary = summary
        } catch {
            self.errorMessage = "Failed to load points: \(error.localizedDescription)"
        }
    }

    func loadBadges() async {
        do {
            let badgesList = try await apiService.fetchBadges()
            self.badges = badgesList
        } catch {
            self.errorMessage = "Failed to load badges: \(error.localizedDescription)"
        }
    }

    func loadReputationInfo() async {
        do {
            let reputation = try await apiService.fetchReputationInfo()
            self.reputationInfo = reputation

            let breakdown = try await apiService.fetchReputationBreakdown()
            self.reputationBreakdown = breakdown

            let events = try await apiService.fetchReputationEvents()
            self.reputationEvents = events
        } catch {
            self.errorMessage = "Failed to load reputation: \(error.localizedDescription)"
        }
    }

    func refresh() async {
        await loadAllProfileData()
    }
}

// MARK: - API Service

class ProfileAPIService {
    static let shared = ProfileAPIService()

    private let baseURL: URL

    enum APIError: LocalizedError {
        case invalidURL
        case networkError
        case httpError(statusCode: Int)
        case decodingError(Error)

        var errorDescription: String? {
            switch self {
            case .invalidURL:               return "Invalid URL"
            case .networkError:             return "Network error occurred"
            case .httpError(let code):      return "HTTP Error: \(code)"
            case .decodingError(let error): return "Failed to decode response: \(error.localizedDescription)"
            }
        }
    }

    init(baseURL: URL? = nil) {
        if let url = baseURL {
            self.baseURL = url
        } else {
            self.baseURL = URL(string: BackendConfig.apiURL)!
        }
    }

    func fetchUserData() async throws -> UserData {
        let endpoint = baseURL.appendingPathComponent("users/me")
        return try await performRequest(url: endpoint)
    }

    func fetchUserProfile() async throws -> UserProfileData {
        let endpoint = baseURL.appendingPathComponent("users/me/profile")
        return try await performRequest(url: endpoint)
    }

    func fetchPointsSummary() async throws -> PointsSummary {
        let endpoint = baseURL.appendingPathComponent("gamification/points/summary")
        return try await performRequest(url: endpoint)
    }

    func fetchPointsHistory(page: Int = 1, pageSize: Int = 20) async throws -> [PointsTransaction] {
        let endpoint = baseURL.appendingPathComponent("gamification/points/history")
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "page_size", value: String(pageSize))
        ]

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        let response: PointsHistoryResponse = try await performRequest(url: url)
        return response.transactions
    }

    func fetchBadges() async throws -> [Badge] {
        let endpoint = baseURL.appendingPathComponent("gamification/badges")
        let response: BadgesResponse = try await performRequest(url: endpoint)
        return response.badges
    }

    func fetchReputationInfo() async throws -> ReputationInfo {
        let endpoint = baseURL.appendingPathComponent("reputation/me")
        return try await performRequest(url: endpoint)
    }

    func fetchReputationBreakdown() async throws -> [ReputationBreakdown] {
        let endpoint = baseURL.appendingPathComponent("reputation/me/breakdown")
        let response: ReputationBreakdownResponse = try await performRequest(url: endpoint)
        return response.breakdown
    }

    func fetchReputationEvents(limit: Int = 20, offset: Int = 0) async throws -> [ReputationEvent] {
        let endpoint = baseURL.appendingPathComponent("reputation/me/events")
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset))
        ]

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        let response: ReputationEventsResponse = try await performRequest(url: url)
        return response.events
    }

    private func performRequest<T: Decodable>(url: URL) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let sessionData = UserDefaults.standard.data(forKey: "userSession"),
           let session = try? JSONDecoder().decode(UserSession.self, from: sessionData) {
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            print("ProfileAPI: Using auth token")
        } else {
            print("ProfileAPI: No UserSession found")
        }

        print("ProfileAPI: Requesting \(url)")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError
        }

        print("ProfileAPI: HTTP Status \(httpResponse.statusCode)")

        if httpResponse.statusCode == 401 {
            if let newToken = try await refreshAccessToken() {
                var retryRequest = request
                retryRequest.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
                let (retryData, retryResponse) = try await URLSession.shared.data(for: retryRequest)
                guard let retryHTTP = retryResponse as? HTTPURLResponse else {
                    throw APIError.networkError
                }
                if (200...299).contains(retryHTTP.statusCode) {
                    return try decodeResponse(retryData)
                }
            }
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("ProfileAPI Error: \(errorMsg)")
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        return try decodeResponse(data)
    }

    private func decodeResponse<T: Decodable>(_ data: Data) throws -> T {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(T.self, from: data)
        } catch {
            print("ProfileAPI Decode Error: \(error)")
            throw APIError.decodingError(error)
        }
    }

    private func refreshAccessToken() async throws -> String? {
        guard let sessionData = UserDefaults.standard.data(forKey: "userSession"),
              let session = try? JSONDecoder().decode(UserSession.self, from: sessionData) else {
            return nil
        }

        let refreshURL = baseURL.appendingPathComponent("auth/refresh")
        var request = URLRequest(url: refreshURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let payload = ["refresh_token": session.refreshToken]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            return nil
        }

        struct RefreshResponse: Codable {
            let access_token: String
            let refresh_token: String
        }

        let refreshed = try JSONDecoder().decode(RefreshResponse.self, from: data)
        let updatedSession = UserSession(
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token,
            userId: session.userId,
            email: session.email,
            displayName: session.displayName,
            role: session.role
        )

        if let encoded = try? JSONEncoder().encode(updatedSession) {
            UserDefaults.standard.set(encoded, forKey: "userSession")
        }

        return refreshed.access_token
    }
}
