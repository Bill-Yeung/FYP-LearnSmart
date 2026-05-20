import SwiftUI

/// AI-Suggest mode: lets the user select flashcards/concepts and asks AI to choose 3D object anchors.
struct AISuggestView: View {

    let palace: MemoryPalace
    var onDone: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var allCards: [ReviewCard] = []
    @State private var allConcepts: [ConceptItem] = []
    @State private var selectedCardIds: Set<String> = []
    @State private var selectedConceptIds: Set<String> = []
    @State private var sourceTab: SourceTab = .flashcards
    @State private var theme: String = ""
    @State private var isLoadingSources = true
    @State private var isGenerating = false
    @State private var errorMessage: String?
    @State private var generatedCount = 0

    private var selectedCards: [ReviewCard] {
        allCards.filter { selectedCardIds.contains($0.id) }
    }

    private var selectedConcepts: [ConceptItem] {
        allConcepts.filter { selectedConceptIds.contains($0.id) }
    }

    private var selectedMemoryItems: [AIMemorySource] {
        selectedCards.map(AIMemorySource.flashcard) + selectedConcepts.map(AIMemorySource.concept)
    }

    private enum SourceTab: String, CaseIterable, Identifiable {
        case flashcards = "Flashcards"
        case concepts = "Concepts"

        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Palace Theme") {
                    TextField("e.g. Ancient Library, Ocean Depth", text: $theme)
                }

                Section {
                    Picker("Source", selection: $sourceTab) {
                        ForEach(SourceTab.allCases) { tab in
                            Text(tab.rawValue).tag(tab)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section {
                    if isLoadingSources {
                        HStack(spacing: 10) {
                            ProgressView().scaleEffect(0.8)
                            Text("Loading memory items…").foregroundStyle(.secondary)
                        }
                    } else if sourceTab == .flashcards {
                        flashcardSelectionList
                    } else {
                        conceptSelectionList
                    }
                } header: {
                    selectionHeader
                }

                if let error = errorMessage {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                    }
                }

                if generatedCount > 0 {
                    Section {
                        Label("\(generatedCount) items placed in palace!", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                }
            }
            .navigationTitle("AI-Suggest Palace")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isGenerating {
                        ProgressView().scaleEffect(0.8)
                    } else {
                        Button("Generate") {
                            Task { await generatePalace() }
                        }
                        .fontWeight(.semibold)
                        .disabled(selectedMemoryItems.isEmpty)
                    }
                }
            }
        }
        .task { await loadSources() }
    }

    // MARK: - Selection Views

    @ViewBuilder
    private var flashcardSelectionList: some View {
        if allCards.isEmpty {
            Text("No flashcards found. Create some flashcards first.")
                .foregroundStyle(.secondary)
        } else {
            ForEach(allCards) { card in
                Toggle(isOn: Binding(
                    get: { selectedCardIds.contains(card.id) },
                    set: { on in
                        if on { selectedCardIds.insert(card.id) }
                        else { selectedCardIds.remove(card.id) }
                    }
                )) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(card.front).font(.body)
                        if let back = card.back, !back.isEmpty {
                            Text(back).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var conceptSelectionList: some View {
        if allConcepts.isEmpty {
            Text("No concepts found. Extract or create concepts first.")
                .foregroundStyle(.secondary)
        } else {
            ForEach(allConcepts) { concept in
                Toggle(isOn: Binding(
                    get: { selectedConceptIds.contains(concept.id) },
                    set: { on in
                        if on { selectedConceptIds.insert(concept.id) }
                        else { selectedConceptIds.remove(concept.id) }
                    }
                )) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(concept.title).font(.body)
                        if let description = concept.description, !description.isEmpty {
                            Text(description).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private var selectionHeader: some View {
        HStack {
            Text("\(sourceTab.rawValue) (\(selectedCount(for: sourceTab)) selected)")
            Spacer()
            if totalCount(for: sourceTab) > 0 {
                Button(allSelected(for: sourceTab) ? "Deselect All" : "Select All") {
                    toggleAll(for: sourceTab)
                }
                .font(.caption)
                .textCase(nil)
            }
        }
    }

    private func selectedCount(for tab: SourceTab) -> Int {
        switch tab {
        case .flashcards: selectedCardIds.count
        case .concepts: selectedConceptIds.count
        }
    }

    private func totalCount(for tab: SourceTab) -> Int {
        switch tab {
        case .flashcards: allCards.count
        case .concepts: allConcepts.count
        }
    }

    private func allSelected(for tab: SourceTab) -> Bool {
        let total = totalCount(for: tab)
        return total > 0 && selectedCount(for: tab) == total
    }

    private func toggleAll(for tab: SourceTab) {
        switch tab {
        case .flashcards:
            selectedCardIds = allSelected(for: tab) ? [] : Set(allCards.map(\.id))
        case .concepts:
            selectedConceptIds = allSelected(for: tab) ? [] : Set(allConcepts.map(\.id))
        }
    }

    // MARK: - Source Loading

    private func loadSources() async {
        isLoadingSources = true
        let token = KeychainService.get(forKey: "access_token") ?? ""
        let cards = (try? await FlashcardService.shared.fetchReviewCards(accessToken: token)) ?? []
        let concepts = (try? await APIService.shared.getConcepts()) ?? []
        allCards = cards
        allConcepts = concepts
        selectedCardIds = Set(cards.map(\.id))
        selectedConceptIds = Set(concepts.map(\.id))
        isLoadingSources = false
    }

    // MARK: - Generation

    private func generatePalace() async {
        let items = selectedMemoryItems
        guard !items.isEmpty else { return }
        isGenerating = true
        errorMessage = nil
        generatedCount = 0

        do {
            let themeName = theme.trimmingCharacters(in: .whitespaces).isEmpty
                ? "Memory Palace"
                : theme.trimmingCharacters(in: .whitespaces)

            let requestItems = items.map { $0.suggestRequestItem }
            let suggestions = try await APIService.shared.suggestPalaceObjects(
                theme: themeName,
                memoryItems: requestItems
            )

            let count = items.count
            let radius: Float = 2.5
            for (i, item) in items.enumerated() {
                guard let suggestion = suggestions.first(where: { $0.memoryItemId == item.id }) else {
                    continue
                }

                let angle = Float(i) / Float(count) * 2 * .pi
                let label = suggestion.objectLabel.isEmpty
                    ? String(item.title.prefix(40))
                    : suggestion.objectLabel
                let reason = suggestion.reason?.trimmingCharacters(in: .whitespacesAndNewlines)
                let customText = [
                    suggestion.memoryText,
                    reason.map { "AI match: \($0)" },
                    item.detailText,
                ]
                    .compactMap { value in
                        guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                            return nil
                        }
                        return value
                    }
                    .joined(separator: "\n\n")

                var create = PalaceItemCreate()
                create.positionX = sin(angle) * radius
                create.positionY = 0.15
                create.positionZ = -cos(angle) * radius
                create.rotationY = -angle * 180 / .pi
                create.label = label
                create.customText = customText
                create.displayType = "3d_model"
                create.assetId = suggestion.assetId
                switch item {
                case .flashcard(let card):
                    create.flashcardId = card.id
                case .concept(let concept):
                    create.conceptId = concept.id
                }

                _ = try await APIService.shared.placeItem(palaceId: palace.id, item: create)
                generatedCount += 1
            }

            onDone()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
            isGenerating = false
        }
    }
}

private enum AIMemorySource {
    case flashcard(ReviewCard)
    case concept(ConceptItem)

    var title: String {
        switch self {
        case .flashcard(let card): card.front
        case .concept(let concept): concept.title
        }
    }

    var id: String {
        switch self {
        case .flashcard(let card): card.id
        case .concept(let concept): concept.id
        }
    }

    var type: String {
        switch self {
        case .flashcard: "flashcard"
        case .concept: "concept"
        }
    }

    var suggestRequestItem: APIService.PalaceSuggestMemoryItem {
        APIService.PalaceSuggestMemoryItem(
            id: id,
            type: type,
            title: title,
            content: promptText
        )
    }

    private var promptText: String {
        switch self {
        case .flashcard(let card):
            return "Flashcard - Q: \(card.front)" + (card.back.map { " | A: \($0)" } ?? "")
        case .concept(let concept):
            return "Concept - \(concept.title)" + (concept.description.map { ": \($0)" } ?? "")
        }
    }

    var detailText: String {
        switch self {
        case .flashcard(let card):
            return "Q: \(card.front)" + (card.back.map { "\nA: \($0)" } ?? "")
        case .concept(let concept):
            var lines = ["Concept: \(concept.title)"]
            if let description = concept.description, !description.isEmpty {
                lines.append(description)
            }
            if let keywords = concept.keywords, !keywords.isEmpty {
                lines.append("Keywords: \(keywords.joined(separator: ", "))")
            }
            return lines.joined(separator: "\n")
        }
    }
}
