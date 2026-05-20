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

    /// Tracks asset IDs that have been downloaded to local cache.
    var downloadedAssetIds: Set<String> = []

    private let api = APIService.shared
    private let pageSize = 50

    func loadModels(reset: Bool = false) async {
        if reset { currentPage = 1 }
        isLoading = true
        errorMessage = nil
        do {
            let query = searchQuery.isEmpty ? nil : searchQuery
            let response = try await api.listModels(search: query, page: currentPage, pageSize: pageSize)
            if reset {
                assets = response.assets
            } else {
                assets.append(contentsOf: response.assets)
            }
            totalCount = response.total
            refreshDownloadedSet()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func refreshDownloadedSet() {
        let downloader = ModelDownloader.shared
        Task {
            let ids = await downloader.cachedAssetIds()
            downloadedAssetIds = ids
        }
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

    func downloadModel(assetId: String) async -> URL? {
        downloadingAssetIds.insert(assetId)
        defer { downloadingAssetIds.remove(assetId) }
        do {
            let url = try await ModelDownloader.shared.localURL(for: assetId)
            downloadedAssetIds.insert(assetId)
            return url
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func evictModel(assetId: String) async {
        await ModelDownloader.shared.evict(assetId: assetId)
        downloadedAssetIds.remove(assetId)
    }

    func thumbnailURL(for assetId: String) -> URL? {
        api.thumbnailURL(assetId: assetId)
    }
}
