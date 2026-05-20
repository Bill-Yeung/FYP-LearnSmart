import Foundation

struct Flashcard: Codable, Identifiable {
    let id: String
    let front: String
    let back: String
    let cardType: String?
    let choices: [String]?
    let correctAnswer: String?
    let dueLabel: String?
    let tips: String?

    enum CodingKeys: String, CodingKey {
        case id, front, back, choices, tips
        case cardType = "card_type"
        case correctAnswer = "correct_answer"
        case dueLabel = "due_label"
    }
}
