import Foundation
import Observation

@MainActor @Observable
class ProfileViewModel {

    var profile: APIService.ProfileResponse?
    var badges: [Badge] = []
    var reputation: Reputation?
    var points: Points?
    var isLoading = false
    var errorMessage: String?

    enum Tab: String, CaseIterable, Identifiable {
        case overview = "Overview"
        case badges = "Badges"
        case reputation = "Reputation"
        case points = "Points"
        var id: String { rawValue }
    }
    var selectedTab: Tab = .overview

    private let api = APIService.shared

    func loadAll() async {
        isLoading = true
        errorMessage = nil
        async let p = api.getProfile()
        async let b = api.getBadges()
        async let r = api.getReputation()
        async let pts = api.getPoints()
        do {
            profile = try await p
            badges = try await b
            reputation = try await r
            points = try await pts
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
