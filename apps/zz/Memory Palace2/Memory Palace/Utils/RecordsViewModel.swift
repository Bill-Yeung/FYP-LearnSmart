//
//  RecordsViewModel.swift
//  Testing Ground
//
//  Created by copilot on 28/2/2026.
//

import Foundation
import Combine

// MARK: - Models

struct FlashcardReviewRecord: Codable, Identifiable {
    let id: String
    let flashcardId: String
    let reviewMode: String?
    let rating: Int?
    let durationMs: Int?
    let scheduledInterval: Double?
    let actualInterval: Double?
    let reviewAt: String?
    let front: String?
    let back: String?
    let topic: String?

    enum CodingKeys: String, CodingKey {
        case id
        case flashcardId    = "flashcard_id"
        case reviewMode     = "review_mode"
        case rating
        case durationMs     = "duration_ms"
        case scheduledInterval = "scheduled_interval"
        case actualInterval    = "actual_interval"
        case reviewAt       = "review_at"
        case front, back, topic
    }
}

struct ReviewHistoryResponse: Codable {
    let history: [FlashcardReviewRecord]
    let total: Int
    let page: Int
    let pageSize: Int

    enum CodingKeys: String, CodingKey {
        case history, total, page
        case pageSize = "page_size"
    }
}

// MARK: - View Model

@MainActor
class RecordsViewModel: ObservableObject {
    @Published var reviewRecords: [FlashcardReviewRecord] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func loadReviewHistory(page: Int = 1, pageSize: Int = 30) async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await APIService.shared.getReviewHistory(page: page, pageSize: pageSize)
            self.reviewRecords = response.history
        } catch {
            self.errorMessage = "Failed to load review history: \(error.localizedDescription)"
        }
        isLoading = false
    }

    func refresh() async {
        await loadReviewHistory()
    }
}

