import Foundation
import Observation

@MainActor @Observable
class AssetLibraryViewModel {

    var assets: [AssetItem] = []
    var totalCount = 0
    var currentPage = 1
    var isLoading = false
    var searchQuery = ""
    var errorMessage: String?

    /// Tracks asset IDs currently being downloaded.
    var downloadingAssetIds: Set<String> = []

    private let api = APIService.shared
    private let pageSize = 50

    func loadModels(reset: Bool = false) async {
        if reset { currentPage = 1 }
        isLoading = true
        errorMessage = nil
        do {
            let query = searchQuery.isEmpty ? nil : searchQuery
            let response = try await api.listModels(search: query, page: currentPage, pageSize: pageSize)
            
            let fetchedAssets = response.assets ?? []
            let fetchedTotal = response.total ?? fetchedAssets.count

            if reset {
                assets = fetchedAssets
            } else {
                assets.append(contentsOf: fetchedAssets)
            }
            totalCount = fetchedTotal
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func loadNextPage() async {
        guard !isLoading, assets.count < totalCount else { return }
        currentPage += 1
        await loadModels()
    }

    func search(_ query: String) async {
        searchQuery = query
        await loadModels(reset: true)
    }

    func downloadModel(assetId: String, modelURL: URL) async -> URL? {
        downloadingAssetIds.insert(assetId)
        defer { downloadingAssetIds.remove(assetId) }
        do {
            return try await ModelDownloader.shared.downloadFromURL(modelURL)
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func thumbnailURL(for assetId: String) -> URL? {
        api.thumbnailURL(assetId: assetId)
    }
}
