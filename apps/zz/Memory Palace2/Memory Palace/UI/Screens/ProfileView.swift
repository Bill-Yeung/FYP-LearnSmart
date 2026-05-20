//
//  ProfileView.swift
//  Testing Ground
//
//  Created by ituser on 29/1/2026.
//

import SwiftUI

struct ProfileView: View {
    @StateObject private var viewModel = ProfileViewModel()

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [
                    Brand.primary.opacity(0.12),
                    Brand.secondary.opacity(0.08),
                    Color.clear
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Picker("", selection: $viewModel.selectedTab) {
                    Text("Overview").tag(ProfileViewModel.ProfileTab.overview)
                    Text("Badges").tag(ProfileViewModel.ProfileTab.badges)
                    Text("Rep").tag(ProfileViewModel.ProfileTab.reputation)
                    Text("Points").tag(ProfileViewModel.ProfileTab.points)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 8)

                if viewModel.isLoading {
                    loadingView
                } else if let error = viewModel.errorMessage {
                    errorView(error)
                } else {
                    contentView
                }
            }
        }
        .navigationTitle("Profile")
        .task {
            await viewModel.loadAllProfileData()
        }
    }

    @ViewBuilder
    private var contentView: some View {
        switch viewModel.selectedTab {
        case .overview:  overviewContent
        case .badges:    badgesContent
        case .reputation: reputationContent
        case .points:    pointsContent
        }
    }

    // MARK: - Overview

    private var overviewContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let userData = viewModel.userData, let profile = viewModel.userProfile {
                    profileHeaderCard(userData: userData, profile: profile)
                        .padding(.horizontal)

                    VStack(spacing: 10) {
                        if let bio = profile.bio, !bio.isEmpty {
                            card {
                                VStack(alignment: .leading, spacing: 6) {
                                    Label("Bio", systemImage: "text.quote")
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.secondary)
                                    Text(bio)
                                        .font(.callout)
                                        .foregroundStyle(.primary)
                                }
                            }
                        }

                        if let org = profile.organization {
                            infoRow(title: "Organization", value: org, systemImage: "building.fill")
                        }

                        if let dept = profile.department {
                            infoRow(title: "Department", value: dept, systemImage: "briefcase.fill")
                        }

                        HStack(spacing: 10) {
                            if let rep = viewModel.reputationInfo {
                                statTile(title: "Reputation", value: String(rep.totalScore), tint: .blue)
                            }
                            if let points = viewModel.pointsSummary {
                                statTile(title: "Points", value: String(points.balance), tint: .green)
                            }
                            statTile(title: "Badges",
                                     value: String(viewModel.badges.filter { $0.earned == true }.count),
                                     tint: .orange)
                        }
                    }
                    .padding(.horizontal)
                } else {
                    Text("Loading profile…")
                        .foregroundStyle(.secondary)
                        .padding(.top, 40)
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
    }

    // MARK: - Badges

    private var badgesContent: some View {
        ScrollView {
            if viewModel.badges.isEmpty {
                emptyState(icon: "star.fill", title: "No Badges Yet", subtitle: "Complete tasks to earn badges")
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(viewModel.badges) { badge in
                        BadgeCard(badge: badge)
                    }
                }
                .padding()
            }
        }
    }

    // MARK: - Reputation

    private var reputationContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let rep = viewModel.reputationInfo {
                    card {
                        VStack(spacing: 12) {
                            VStack(spacing: 2) {
                                Text(String(rep.totalScore))
                                    .font(.system(size: 40, weight: .bold, design: .rounded))
                                    .foregroundStyle(Brand.primary)
                                Text("Total Score")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Divider()

                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Level")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text(rep.levelName)
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text("Rank")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text(String(format: "Top %.0f%%", rep.rankPercentile))
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                }
                            }

                            if let nextLevel = rep.nextLevelName {
                                Divider()
                                VStack(spacing: 6) {
                                    HStack {
                                        Text("Next: \(nextLevel)")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                        Spacer()
                                        Text("\(rep.pointsToNext) pts to go")
                                            .font(.caption2)
                                            .fontWeight(.semibold)
                                            .foregroundStyle(.secondary)
                                    }
                                    ProgressView(value: Double(max(0, rep.totalScore % 100)), total: 100)
                                        .tint(Brand.primary)
                                }
                            }
                        }
                    }
                    .padding(.horizontal)

                    if !viewModel.reputationBreakdown.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Breakdown")
                                .font(.headline)
                                .fontWeight(.semibold)
                                .padding(.horizontal)

                            ForEach(viewModel.reputationBreakdown, id: \.dimension) { item in
                                card {
                                    HStack(spacing: 12) {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(item.dimension)
                                                .font(.subheadline)
                                                .fontWeight(.medium)
                                            ProgressView(value: item.percentage / 100)
                                                .tint(Brand.primary)
                                        }
                                        Text(String(item.score))
                                            .font(.subheadline)
                                            .fontWeight(.semibold)
                                            .frame(width: 40, alignment: .trailing)
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }
                    }

                    if !viewModel.reputationEvents.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Recent Events")
                                .font(.headline)
                                .fontWeight(.semibold)
                                .padding(.horizontal)

                            ForEach(viewModel.reputationEvents.prefix(5)) { event in
                                card {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(event.eventType)
                                                .font(.subheadline)
                                                .fontWeight(.medium)
                                            Text(event.dimension)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        VStack(alignment: .trailing, spacing: 2) {
                                            Text(String(format: "%+d", event.pointsChange))
                                                .font(.subheadline)
                                                .fontWeight(.semibold)
                                                .foregroundStyle(event.pointsChange >= 0 ? .green : .red)
                                            Text(formatDate(event.createdAt ?? ""))
                                                .font(.caption2)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }
                    }
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
    }

    // MARK: - Points

    private var pointsContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let points = viewModel.pointsSummary {
                    card {
                        VStack(spacing: 12) {
                            VStack(spacing: 2) {
                                Text(String(points.balance))
                                    .font(.system(size: 40, weight: .bold, design: .rounded))
                                    .foregroundStyle(.green)
                                Text("Point Balance")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Divider()

                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Current Streak")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text("\(points.streak.current) days")
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.orange)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text("Longest Streak")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text("\(points.streak.longest) days")
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.orange)
                                }
                            }

                            Divider()

                            HStack {
                                Label("Earned", systemImage: "arrow.up.circle.fill")
                                    .font(.caption)
                                    .foregroundStyle(.green)
                                Spacer()
                                Text(String(points.totalEarned))
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                            }

                            HStack {
                                Label("Spent", systemImage: "arrow.down.circle.fill")
                                    .font(.caption)
                                    .foregroundStyle(.red)
                                Spacer()
                                Text(String(points.totalSpent))
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                            }
                        }
                    }
                    .padding(.horizontal)

                    if !points.pointsByType.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Points by Type")
                                .font(.headline)
                                .fontWeight(.semibold)
                                .padding(.horizontal)

                            ForEach(points.pointsByType.sorted(by: { $0.total > $1.total }), id: \.name) { entry in
                                card {
                                    HStack {
                                        Text(entry.name)
                                            .font(.subheadline)
                                            .fontWeight(.medium)
                                        Spacer()
                                        Text(String(entry.total))
                                            .font(.subheadline)
                                            .fontWeight(.semibold)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }
                    }
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
    }

    // MARK: - Helpers

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading profile…")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(_ error: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(.red)
            Text("Error Loading Profile")
                .font(.headline)
            Text(error)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Retry")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.headline)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    /// Card with a glass material background — visible on visionOS.
    private func card<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding()
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.15), lineWidth: 1)
            )
    }

    private func infoRow(title: String, value: String, systemImage: String) -> some View {
        card {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .foregroundStyle(Brand.primary)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(value)
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                Spacer()
            }
        }
    }

    private func profileHeaderCard(userData: UserData, profile: UserProfileData) -> some View {
        VStack(spacing: 16) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Brand.heroGradient)
                    .frame(width: 88, height: 88)
                Text(String(userData.displayName.prefix(1)).uppercased())
                    .font(.system(size: 36, weight: .bold))
                    .foregroundStyle(.white)
            }
            .shadow(color: Brand.primary.opacity(0.4), radius: 12, y: 4)

            VStack(spacing: 6) {
                Text(userData.displayName)
                    .font(.title3)
                    .fontWeight(.bold)

                Text(userData.email)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(userData.role.uppercased())
                    .font(.caption2)
                    .fontWeight(.bold)
                    .tracking(1)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(Brand.primary, in: Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(Brand.primary.opacity(0.25), lineWidth: 1)
        )
    }

    private func statTile(title: String, value: String, tint: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(tint)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(tint.opacity(0.3), lineWidth: 1)
        )
    }

    private func formatDate(_ dateString: String) -> String {
        guard !dateString.isEmpty else { return "" }
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        guard let date = withFractional.date(from: dateString) ?? plain.date(from: dateString) else {
            return dateString
        }
        if Calendar.current.isDateInToday(date) {
            let f = DateFormatter()
            f.timeStyle = .short
            return f.string(from: date)
        } else {
            let f = DateFormatter()
            f.dateStyle = .short
            return f.string(from: date)
        }
    }
}

// MARK: - Badge Card

struct BadgeCard: View {
    let badge: Badge

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(badge.earned == true ? Brand.primary.opacity(0.18) : Color.white.opacity(0.06))
                    .frame(height: 64)
                Image(systemName: "star.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(badge.earned == true ? Brand.primary : Color.secondary)
            }

            VStack(spacing: 3) {
                Text(badge.name)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)

                if let desc = badge.description {
                    Text(desc)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                }

                Text(badge.earned == true ? "Earned" : "Locked")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(badge.earned == true ? .green : .secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(badge.earned == true ? Brand.primary.opacity(0.3) : Color.white.opacity(0.1), lineWidth: 1)
        )
        .opacity(badge.earned == true ? 1.0 : 0.55)
    }
}

#Preview {
    NavigationStack {
        ProfileView()
    }
}
