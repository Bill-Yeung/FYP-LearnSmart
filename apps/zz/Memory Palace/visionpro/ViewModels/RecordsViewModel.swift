import Foundation
import Observation

@MainActor @Observable
class RecordsViewModel {

    var gameRecords: [GameRecord] = []
    var activityFeed: [ActivityRecord] = []
    var isLoading = false
    var errorMessage: String?

    enum Tab: String, CaseIterable, Identifiable {
        case games = "Games"
        case activity = "Activity"
        var id: String { rawValue }
    }
    var selectedTab: Tab = .games

    private let api = APIService.shared

    func loadGameRecords(page: Int = 1) async {
        isLoading = true
        errorMessage = nil
        do {
            let records = try await api.getGameRecords(page: page)
            if page == 1 {
                gameRecords = records
            } else {
                gameRecords.append(contentsOf: records)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func loadActivityFeed(page: Int = 1) async {
        isLoading = true
        errorMessage = nil
        do {
            let records = try await api.getActivityFeed(page: page)
            if page == 1 {
                activityFeed = records
            } else {
                activityFeed.append(contentsOf: records)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
