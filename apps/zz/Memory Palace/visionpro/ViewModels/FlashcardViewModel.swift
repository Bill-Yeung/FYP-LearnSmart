import Foundation
import Observation

@MainActor @Observable
class FlashcardViewModel {

    var cards: [Flashcard] = []
    var isLoading = false
    var errorMessage: String?

    private let api = APIService.shared

    func loadReviewCards() async {
        isLoading = true
        errorMessage = nil
        do {
            cards = try await api.getReviewCards()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func deleteCard(id: String) async {
        do {
            try await api.deleteFlashcard(id: id)
            cards.removeAll { $0.id == id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
