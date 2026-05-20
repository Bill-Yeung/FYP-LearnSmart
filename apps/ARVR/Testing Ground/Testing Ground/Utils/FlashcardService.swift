//
//  FlashcardService.swift
//  Testing Ground
//
//  Created by copilot on 02/25/2026.
//

import Foundation

// MARK: - AnyCodable for flexible field types

enum AnyCodable: Codable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([AnyCodable])
    case object([String: AnyCodable])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let int = try? container.decode(Int.self) {
            self = .int(int)
        } else if let double = try? container.decode(Double.self) {
            self = .double(double)
        } else if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let array = try? container.decode([AnyCodable].self) {
            self = .array(array)
        } else if let object = try? container.decode([String: AnyCodable].self) {
            self = .object(object)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode AnyCodable")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null:
            try container.encodeNil()
        case .bool(let bool):
            try container.encode(bool)
        case .int(let int):
            try container.encode(int)
        case .double(let double):
            try container.encode(double)
        case .string(let string):
            try container.encode(string)
        case .array(let array):
            try container.encode(array)
        case .object(let object):
            try container.encode(object)
        }
    }
}

// MARK: - Review Models

struct ReviewAttachment: Codable, Identifiable {
    let id: String
    let mediaType: String?
    let fileURL: String?
    let mediaPosition: String?

    enum CodingKeys: String, CodingKey {
        case id
        case mediaType = "media_type"
        case fileURL = "file_url"
        case mediaPosition = "media_position"
    }
}

struct ReviewMnemonic: Codable {
    let id: String?
    let content: String?
    let mnemonicType: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, content
        case mnemonicType = "mnemonic_type"
        case createdAt = "created_at"
    }
}

struct ReviewCard: Codable, Identifiable {
    let id: String
    let front: String
    let back: String?
    let cardType: String?
    let topic: String?
    let choices: AnyCodable?
    let correctAnswer: String?
    let dueLabel: String?
    let tips: String?
    let attachments: [ReviewAttachment]?
    let mnemonics: [ReviewMnemonic]?

    enum CodingKeys: String, CodingKey {
        case id, front, back, topic
        case cardType = "card_type"
        case choices
        case correctAnswer = "correct_answer"
        case dueLabel = "due_label"
        case tips
        case attachments
        case mnemonics
    }
}

// MARK: - Service

final class FlashcardService {
    static let shared = FlashcardService()

    private let urlSession: URLSession

    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60
        configuration.waitsForConnectivity = true
        self.urlSession = URLSession(configuration: configuration)
    }

    /// Fetch review cards for the current user from the backend using access token.
    /// Falls back to mock data if backend request fails.
    func fetchReviewCards(accessToken: String) async throws -> [ReviewCard] {
        do {
            // Try to fetch from backend first with user's access token
            let cards = try await fetchFromBackend(accessToken: accessToken)
            let uniqueCards = deduplicatedCards(cards)
            print("Loaded \(uniqueCards.count) flashcards from backend for logged-in user")
            return uniqueCards
        } catch {
            print("Failed to fetch from backend: \(error.localizedDescription)")
            print("Using mock flashcard data instead")
            return getMockFlashcards()
        }
    }

    /// Fetch from backend API endpoint with user authentication
    private func fetchFromBackend(accessToken: String) async throws -> [ReviewCard] {
        // Derive flashcards base from AssetAPIService
        var flashcardBase = AssetAPIService.shared.baseURL

        if flashcardBase.contains("/api/models") {
            flashcardBase = flashcardBase.replacingOccurrences(of: "/api/models", with: "/api/flashcards")
        } else if flashcardBase.contains("/api/") {
            // If base contains other api prefix, try to replace
            flashcardBase = flashcardBase.replacingOccurrences(of: "/api/", with: "/api/flashcards/")
        } else if flashcardBase.hasSuffix("/") {
            flashcardBase += "api/flashcards"
        } else {
            flashcardBase += "/api/flashcards"
        }

        let endpoint = flashcardBase.hasSuffix("/review") ? flashcardBase : flashcardBase + "/review"
        
        print("Fetching flashcards from: \(endpoint) for user")

        let pageSize = 200
        var page = 1
        var all: [ReviewCard] = []
        var total: Int? = nil

        while true {
            guard var components = URLComponents(string: endpoint) else {
                throw AssetAPIError.invalidURL
            }
            components.queryItems = [
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "page_size", value: String(pageSize))
            ]
            guard let url = components.url else {
                throw AssetAPIError.invalidURL
            }

            // Create request with bearer token
            var request = URLRequest(url: url)
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            let (data, response) = try await urlSession.data(for: request)

            if let http = response as? HTTPURLResponse, http.statusCode != 200 {
                print("HTTP Error: \(http.statusCode)")
                throw AssetAPIError.httpError(statusCode: http.statusCode)
            }

            let decoder = JSONDecoder()

            if let pageObj = try? decoder.decode(ReviewPage.self, from: data) {
                all.append(contentsOf: pageObj.cards)
                total = pageObj.total ?? total

                let reachedTotal = total.map { all.count >= $0 } ?? false
                if reachedTotal || pageObj.cards.isEmpty {
                    break
                }
                page += 1
                continue
            }

            // Fallback: decode as array or flashcards/data wrapper
            if let cards = try? decoder.decode([ReviewCard].self, from: data) {
                return deduplicatedCards(cards)
            }
            if let wrapper = try? decoder.decode([String: [ReviewCard]].self, from: data), let arr = wrapper["flashcards"] {
                return deduplicatedCards(arr)
            }
            if let wrapper = try? decoder.decode([String: [ReviewCard]].self, from: data), let arr = wrapper["data"] {
                return deduplicatedCards(arr)
            }

            break
        }

        return deduplicatedCards(all)
    }

    private func deduplicatedCards(_ cards: [ReviewCard]) -> [ReviewCard] {
        var seen = Set<String>()
        return cards.filter { card in
            seen.insert(card.id).inserted
        }
    }

    private struct ReviewPage: Codable {
        let cards: [ReviewCard]
        let total: Int?
        let page: Int?
        let pageSize: Int?

        enum CodingKeys: String, CodingKey {
            case cards, total, page
            case pageSize = "page_size"
        }
    }

    /// Mock flashcard data for testing
    private func getMockFlashcards() -> [ReviewCard] {
        return [
            ReviewCard(
                id: UUID().uuidString,
                front: "What is the capital of France?",
                back: "Paris",
                cardType: "multiple-choice",
                topic: "Geography",
                choices: .null,
                correctAnswer: "Paris",
                dueLabel: "Today",
                tips: "Think of the Eiffel Tower",
                attachments: [],
                mnemonics: []
            ),
            ReviewCard(
                id: UUID().uuidString,
                front: "What is 2 + 2?",
                back: "4",
                cardType: "math",
                topic: "Mathematics",
                choices: .null,
                correctAnswer: "4",
                dueLabel: "Today",
                tips: "Basic arithmetic",
                attachments: [],
                mnemonics: []
            ),
            ReviewCard(
                id: UUID().uuidString,
                front: "What is the largest planet in our solar system?",
                back: "Jupiter",
                cardType: "science",
                topic: "Astronomy",
                choices: .null,
                correctAnswer: "Jupiter",
                dueLabel: "Tomorrow",
                tips: "It's a gas giant",
                attachments: [],
                mnemonics: []
            ),
            ReviewCard(
                id: UUID().uuidString,
                front: "Who painted the Mona Lisa?",
                back: "Leonardo da Vinci",
                cardType: "art",
                topic: "Art History",
                choices: .null,
                correctAnswer: "Leonardo da Vinci",
                dueLabel: "Tomorrow",
                tips: "Italian Renaissance artist",
                attachments: [],
                mnemonics: []
            ),
            ReviewCard(
                id: UUID().uuidString,
                front: "What is the chemical symbol for Gold?",
                back: "Au",
                cardType: "chemistry",
                topic: "Chemistry",
                choices: .null,
                correctAnswer: "Au",
                dueLabel: "Next Week",
                tips: "From Latin 'aurum'",
                attachments: [],
                mnemonics: []
            )
        ]
    }
}
