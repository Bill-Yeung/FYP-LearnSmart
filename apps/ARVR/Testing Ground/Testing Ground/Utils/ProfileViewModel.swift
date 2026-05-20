//
//  ProfileViewModel.swift
//  Testing Ground
//

import Foundation
import Combine

@MainActor
class ProfileViewModel: ObservableObject {
    @Published var userData: APIService.ProfileResponse?
    @Published var pointsSummary: Points?
    @Published var badges: [Badge] = []
    @Published var reputationInfo: Reputation?

    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedTab: ProfileTab = .overview

    private let api = APIService.shared

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
            group.addTask { await self.loadPointsSummary() }
            group.addTask { await self.loadBadges() }
            group.addTask { await self.loadReputationInfo() }
        }

        isLoading = false
    }

    func loadUserData() async {
        do {
            userData = try await api.getProfile()
        } catch {
            errorMessage = "Failed to load user data: \(error.localizedDescription)"
        }
    }

    func loadPointsSummary() async {
        do {
            pointsSummary = try await api.getPoints()
        } catch {
            errorMessage = "Failed to load points: \(error.localizedDescription)"
        }
    }

    func loadBadges() async {
        do {
            badges = try await api.getBadges()
        } catch {
            errorMessage = "Failed to load badges: \(error.localizedDescription)"
        }
    }

    func loadReputationInfo() async {
        do {
            reputationInfo = try await api.getReputation()
        } catch {
            errorMessage = "Failed to load reputation: \(error.localizedDescription)"
        }
    }

    func refresh() async {
        await loadAllProfileData()
    }
}
