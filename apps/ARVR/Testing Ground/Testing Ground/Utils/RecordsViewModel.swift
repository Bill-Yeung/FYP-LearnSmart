//
//  RecordsViewModel.swift
//  Testing Ground
//
//  Created by copilot on 28/2/2026.
//

import Foundation
import Combine

// MARK: - Models

struct RecordsListResponse: Codable {
    let scripts: [GameRecord]
    let total: Int
    let page: Int?
    let pageSize: Int?

    enum CodingKeys: String, CodingKey {
        case scripts, total, page
        case pageSize = "page_size"
    }
}

struct ContentInfo: Codable {
    let title: String
    let description: String
    let link: String?
}

// MARK: - View Model

@MainActor
class RecordsViewModel: ObservableObject {
    @Published var gameRecords: [GameRecord] = []
    @Published var activityRecords: [ActivityRecord] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedTab: RecordsTab = .games
    
    private let apiService = RecordsAPIService.shared
    
    enum RecordsTab {
        case games
        case activity
    }
    
    func loadGameRecords(page: Int = 1, pageSize: Int = 20) async {
        isLoading = true
        errorMessage = nil
        
        do {
            let response = try await apiService.fetchGameRecords(page: page, pageSize: pageSize)
            self.gameRecords = response.scripts
            self.isLoading = false
        } catch {
            self.errorMessage = "Failed to load game records: \(error.localizedDescription)"
            self.isLoading = false
        }
    }
    
    func loadActivityRecords(page: Int = 1, pageSize: Int = 20) async {
        isLoading = true
        errorMessage = nil
        
        do {
            let response = try await apiService.fetchActivityRecords(page: page, pageSize: pageSize)
            self.activityRecords = response.activities
            self.isLoading = false
        } catch {
            self.errorMessage = "Failed to load activity records: \(error.localizedDescription)"
            self.isLoading = false
        }
    }
    
    func refresh() async {
        switch selectedTab {
        case .games:
            await loadGameRecords()
        case .activity:
            await loadActivityRecords()
        }
    }
}

// MARK: - Activity Feed Response Model

struct ActivityFeedResponse: Codable {
    let activities: [ActivityRecord]
    let total: Int
    let page: Int
    let pageSize: Int
    
    enum CodingKeys: String, CodingKey {
        case activities, total, page
        case pageSize = "page_size"
    }
}

// MARK: - API Service

class RecordsAPIService {
    static let shared = RecordsAPIService()

    private let baseURL: URL

    init(baseURL: URL? = nil) {
        if let url = baseURL {
            self.baseURL = url
        } else {
            self.baseURL = URL(string: BackendConfig.apiURL)!
        }
    }
    
    // MARK: - Game Records API
    
    func fetchGameRecords(page: Int = 1, pageSize: Int = 20) async throws -> RecordsListResponse {
        let endpoint = baseURL.appendingPathComponent("game/my-scripts")
        guard let url = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)?.url else {
            throw APIError.invalidURL
        }
        return try await performRequest(url: url)
    }
    
    // MARK: - Activity Feed API
    
    func fetchActivityRecords(
        page: Int = 1,
        pageSize: Int = 20,
        feedType: String = "all"
    ) async throws -> ActivityFeedResponse {
        let endpoint = baseURL.appendingPathComponent("activity-feed")
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "page_size", value: String(pageSize)),
            URLQueryItem(name: "feed_type", value: feedType)
        ]
        
        guard let url = components.url else {
            throw APIError.invalidURL
        }
        
        return try await performRequest(url: url)
    }
    
    // MARK: - Private Helper Methods
    
    private func performRequest<T: Decodable>(url: URL) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Retrieve auth token from UserSession stored in UserDefaults
        if let sessionData = UserDefaults.standard.data(forKey: "userSession"),
           let session = try? JSONDecoder().decode(UserSession.self, from: sessionData) {
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            print("RecordsAPI: Using auth token from UserSession")
        } else {
            print("RecordsAPI: No UserSession found in UserDefaults")
        }
        
        print("RecordsAPI: Requesting \(url)")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError
        }
        
        print("RecordsAPI: HTTP Status \(httpResponse.statusCode)")
        
        if let responseString = String(data: data, encoding: .utf8) {
            print("RecordsAPI: Response data: \(responseString.prefix(200))")
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("RecordsAPI Error: \(errorMsg)")
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }
        
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(T.self, from: data)
        } catch {
            print("RecordsAPI Decode Error: \(error)")
            throw APIError.decodingError(error)
        }
    }
}

// MARK: - API Error

enum APIError: LocalizedError {
    case invalidURL
    case networkError
    case httpError(statusCode: Int)
    case decodingError(Error)
    case unknown
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .networkError:
            return "Network error occurred"
        case .httpError(let statusCode):
            return "HTTP Error: \(statusCode)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .unknown:
            return "Unknown error"
        }
    }
}
