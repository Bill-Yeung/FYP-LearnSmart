//
//  DatabaseDebugView.swift
//  Testing Ground
//
//  Debug view to show asset_library table structure and sample data
//

import SwiftUI

struct DatabaseDebugView: View {
    @State private var assets: [AssetItem] = []
    @State private var totalCount: Int = 0
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedAsset: AssetItem?
    @State private var reviewCards: [ReviewCard] = []
    @State private var isLoadingCards = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    
                    // MARK: - Connection Status
                    connectionStatusSection
                    
                    // MARK: - Table Statistics
                    if !isLoading && !assets.isEmpty {
                        tableStatsSection
                    }
                    
                    // MARK: - Sample Data
                    if !assets.isEmpty {
                        sampleDataSection
                    }

                    // MARK: - Review Cards
                    reviewCardsSection
                    
                    // MARK: - Error Display
                    if let error = errorMessage {
                        errorSection(error)
                    }
                }
                .padding()
            }
            .navigationTitle("Database Debug")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack {
                        Button(action: { Task { await loadDatabaseInfo() } }) {
                            Image(systemName: "arrow.clockwise")
                        }

                        Button(action: { Task { await loadReviewCards() } }) {
                            Image(systemName: "book.circle")
                        }
                    }
                }
            }
        }
        .task {
            await loadDatabaseInfo()
        }
    }
    
    // MARK: - Connection Status Section
    private var connectionStatusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Connection Status")
                .font(.headline)
            
            HStack {
                Image(systemName: isLoading ? "circle.fill" : (errorMessage == nil ? "checkmark.circle.fill" : "xmark.circle.fill"))
                    .foregroundColor(isLoading ? .orange : (errorMessage == nil ? .green : .red))
                
                Text(isLoading ? "Connecting..." : (errorMessage == nil ? "Connected to backend" : "Connection failed"))
                    .font(.subheadline)
                
                Spacer()
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(8)
            
            Text("Backend: http://localhost:8000/api/models")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Review Cards Section
    private var reviewCardsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Review Cards")
                .font(.headline)

            if isLoadingCards {
                ProgressView("Loading review cards...")
            } else if !reviewCards.isEmpty {
                Text("Loaded: \(reviewCards.count) cards")
                    .font(.subheadline)

                ForEach(reviewCards.prefix(5)) { card in
                    VStack(alignment: .leading) {
                        Text(card.front)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        if let back = card.back {
                            Text(back)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(8)
                    .background(Color(.systemGray6))
                    .cornerRadius(6)
                }
            } else {
                Text("No review cards loaded. Tap the book icon to fetch.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.top)
    }
    
    // MARK: - Table Statistics Section
    private var tableStatsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("asset_library Table")
                .font(.headline)
            
            Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 8) {
                GridRow {
                    Text("Total Records:")
                        .foregroundColor(.secondary)
                    Text("\(totalCount)")
                        .fontWeight(.semibold)
                }
                
                GridRow {
                    Text("Loaded Sample:")
                        .foregroundColor(.secondary)
                    Text("\(assets.count)")
                        .fontWeight(.semibold)
                }
                
                GridRow {
                    Text("Table Columns:")
                        .foregroundColor(.secondary)
                    Text("9")
                        .fontWeight(.semibold)
                }
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(8)
            
            // Column Schema
            VStack(alignment: .leading, spacing: 4) {
                Text("Columns:")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                ForEach(tableColumns, id: \.name) { column in
                    HStack {
                        Text("•")
                            .foregroundColor(.blue)
                        Text(column.name)
                            .font(.caption)
                            .fontDesign(.monospaced)
                        Text("(\(column.type))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(.horizontal)
        }
    }
    
    // MARK: - Sample Data Section
    private var sampleDataSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Sample Records")
                .font(.headline)
            
            ForEach(assets) { asset in
                Button {
                    selectedAsset = asset
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        // Header
                        HStack {
                            Text(asset.name ?? "Unknown")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .lineLimit(1)
                            
                            Spacer()
                            
                            Text(asset.source ?? "Unknown")
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.blue.opacity(0.2))
                                .cornerRadius(4)
                        }
                        
                        // Fields
                        Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 4) {
                            GridRow {
                                Text("ID:")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text(String(asset.id.prefix(8)) + "...")
                                    .font(.caption)
                                    .fontDesign(.monospaced)
                            }
                            
                            GridRow {
                                Text("external_id:")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text(asset.externalId ?? "nil")
                                    .font(.caption)
                                    .fontDesign(.monospaced)
                            }
                            
                            GridRow {
                                Text("asset_type:")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text(asset.assetType ?? "Unknown")
                                    .font(.caption)
                            }
                            
                            if let proxy = URL(string: "\(AssetAPIService.shared.baseURL)/\(asset.id)/thumbnail") {
                                GridRow {
                                    Text("thumbnail:")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text(proxy.absoluteString.prefix(40) + "...")
                                        .font(.caption)
                                        .lineLimit(1)
                                }
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
            }
        }
        .sheet(item: $selectedAsset) { asset in
            AssetDetailSheet(asset: asset)
        }
    }
    
    // MARK: - Error Section
    private func errorSection(_ error: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Error")
                .font(.headline)
                .foregroundColor(.red)
            
            Text(error)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text("Troubleshooting:")
                .font(.caption)
                .fontWeight(.semibold)
                .padding(.top, 4)
            
            VStack(alignment: .leading, spacing: 4) {
                Text("1. Check Docker is running: docker ps")
                Text("2. Check PostgreSQL: docker compose exec postgres psql -U admin -d learning_platform")
                Text("3. Check backend: curl http://localhost:8000/health")
                Text("4. Verify tables: SELECT COUNT(*) FROM asset_library;")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.red.opacity(0.1))
        .cornerRadius(8)
    }
    
    // MARK: - Data Loading
    @MainActor
    private func loadDatabaseInfo() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        
        do {
            print("[Debug] Fetching asset_library data...")
            
            let response = try await AssetAPIService.shared.listAssets(
                assetType: nil, // Get all types
                search: nil,
                page: 1,
                pageSize: 5 // Show first 5 records
            )
            
            let fetchedAssets = response.assets ?? []
            let fetchedTotal = response.total ?? 0
            
            self.assets = fetchedAssets
            self.totalCount = fetchedTotal
            
            print("[Debug] Loaded \(fetchedAssets.count) of \(fetchedTotal) total records")
            
            // Print detailed info
            for (index, asset) in fetchedAssets.enumerated() {
                let assetName = asset.name ?? "nil"
                let assetSource = asset.source ?? "nil"
                let assetTypeStr = asset.assetType ?? "nil"
                let assetThumb = asset.thumbnailURL?.absoluteString ?? "nil"
                let assetRawKeys = asset.rawApiData?.keys.joined(separator: ", ") ?? "nil"
                let assetCreatedAt = asset.createdAt ?? "nil"
                
                print("--- Record \(index + 1) ---")
                print("  id: \(asset.id)")
                print("  external_id: \(asset.externalId ?? "nil")")
                print("  name: \(assetName)")
                print("  source: \(assetSource)")
                print("  asset_type: \(assetTypeStr)")
                print("  thumbnail: \(assetThumb)")
                print("  raw_api_data keys: \(assetRawKeys)")
                print("  created_at: \(assetCreatedAt)")
            }
            
        } catch let error as AssetAPIError {
            errorMessage = error.localizedDescription
            print("[Debug] API Error: \(errorMessage ?? "")")
        } catch {
            errorMessage = "Network error: \(error.localizedDescription)"
            print("[Debug] Error: \(errorMessage ?? "")")
        }
    }

    // MARK: - Load Review Cards
    @MainActor
    private func loadReviewCards() async {
        isLoadingCards = true
        defer { isLoadingCards = false }
        do {
            print("[Debug] Fetching review cards...")
            // For debug view, use empty token as fallback (will use mock data)
            let cards = try await FlashcardService.shared.fetchReviewCards(accessToken: "debug-token")
            reviewCards = cards
            print("[Debug] Loaded review cards: \(cards.count)")
            for (i, c) in cards.enumerated() {
                print("--- Card \(i+1) ---")
                print(" id: \(c.id)")
                print(" front: \(c.front)")
                print(" back: \(c.back ?? "nil")")
                print(" card_type: \(c.cardType ?? "nil")")
            }
        } catch let error as AssetAPIError {
            errorMessage = error.localizedDescription
            print("[Debug] Flashcard API Error: \(errorMessage ?? "")")
        } catch {
            errorMessage = "Flashcard network error: \(error.localizedDescription)"
            print("[Debug] Error: \(error.localizedDescription)")
        }
    }
}

// MARK: - Asset Detail Sheet
struct AssetDetailSheet: View {
    let asset: AssetItem
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    
                    // Thumbnail (use server proxy to avoid normal maps)
                    if let proxy = URL(string: "\(AssetAPIService.shared.baseURL)/\(asset.id)/thumbnail") {
                        AsyncImage(url: proxy) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                        } placeholder: {
                            ProgressView()
                        }
                        .frame(maxHeight: 200)
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                    }
                    
                    // All Fields
                    Group {
                        fieldRow(label: "ID", value: asset.id)
                        fieldRow(label: "external_id", value: asset.externalId ?? "nil")
                        fieldRow(label: "name", value: asset.name ?? "Unknown")
                        fieldRow(label: "source", value: asset.source ?? "Unknown")
                        fieldRow(label: "asset_type", value: asset.assetType ?? "Unknown")
                        let createdAtString = asset.createdAt.map { String(describing: $0) } ?? "nil"
                        fieldRow(label: "created_at", value: createdAtString)
                    }
                    
                    // Raw API Data (JSONB column)
                    if let rawData = asset.rawApiData {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("raw_api_data (JSONB)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            ScrollView(.horizontal, showsIndicators: true) {
                                Text(formatJSON(rawData))
                                    .font(.caption)
                                    .fontDesign(.monospaced)
                                    .textSelection(.enabled)
                            }
                            .frame(maxHeight: 200)
                            .padding(8)
                            .background(Color(.systemGray6))
                            .cornerRadius(4)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Asset Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
    
    private func fieldRow(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.subheadline)
                .fontDesign(.monospaced)
                .textSelection(.enabled)
        }
        .padding(.vertical, 4)
    }
    
    private func formatJSON(_ dict: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: dict, options: [.prettyPrinted, .sortedKeys]),
              let string = String(data: data, encoding: .utf8) else {
            return String(describing: dict)
        }
        return string
    }
}

// MARK: - Table Column Model
struct TableColumn {
    let name: String
    let type: String
}

private let tableColumns: [TableColumn] = [
    TableColumn(name: "id", type: "UUID"),
    TableColumn(name: "external_id", type: "VARCHAR(100)"),
    TableColumn(name: "name", type: "VARCHAR(255)"),
    TableColumn(name: "source", type: "VARCHAR(50)"),
    TableColumn(name: "asset_type", type: "VARCHAR(20)"),
    TableColumn(name: "raw_api_data", type: "JSONB"),
    TableColumn(name: "thumbnail_url", type: "TEXT"),
    TableColumn(name: "preview_url", type: "TEXT"),
    TableColumn(name: "created_at", type: "TIMESTAMP")
]

// MARK: - Preview
#Preview {
    DatabaseDebugView()
}
