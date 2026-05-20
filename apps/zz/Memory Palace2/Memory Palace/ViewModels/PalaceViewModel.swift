import Foundation
import Observation

@MainActor @Observable
class PalaceViewModel {

    var palaces: [MemoryPalace] = []
    var currentPalace: MemoryPalace?
    var items: [PalaceItem] = []
    var reviewItems: [PalaceItem] = []
    var isLoading = false
    var errorMessage: String?

    private let api = APIService.shared

    // MARK: - Palaces

    func loadPalaces(mode: String? = nil) async {
        isLoading = true
        errorMessage = nil
        do {
            palaces = try await api.listPalaces(mode: mode)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func createPalace(name: String, description: String?, mode: String, skyboxType: String, skyboxPreset: String?) async {
        isLoading = true
        errorMessage = nil
        do {
            let palace = try await api.createPalace(
                name: name, description: description,
                mode: mode, skyboxType: skyboxType, skyboxPreset: skyboxPreset
            )
            palaces.insert(palace, at: 0)
            currentPalace = palace
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func selectPalace(_ palace: MemoryPalace) async {
        currentPalace = palace
        await loadItems()
    }

    func deletePalace(_ palace: MemoryPalace) async {
        do {
            try await api.deletePalace(palaceId: palace.id)
            palaces.removeAll { $0.id == palace.id }
            if currentPalace?.id == palace.id {
                currentPalace = nil
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func openPalace(_ palace: MemoryPalace) async -> MemoryPalace? {
        do {
            let updated = try await api.openPalace(palaceId: palace.id)
            if let idx = palaces.firstIndex(where: { $0.id == palace.id }) {
                palaces[idx] = updated
            }
            currentPalace = updated
            await loadItems()
            return updated
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func exitPalace() {
        currentPalace = nil
        items = []
        reviewItems = []
    }

    func seedDemoIfNeeded() async {
        guard palaces.isEmpty else { return }
        do {
            let seeded = try await api.seedDemoPalaces()
            palaces = seeded
        } catch {
            print("Demo seed failed: \(error)")
        }
    }

    // MARK: - Items

    func loadItems() async {
        guard let palace = currentPalace else { return }
        isLoading = true
        do {
            items = try await api.getPalaceItems(palaceId: palace.id)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func placeItem(_ item: PalaceItemCreate) async {
        guard let palace = currentPalace else { return }
        do {
            let placed = try await api.placeItem(palaceId: palace.id, item: item)
            items.append(placed)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updatePosition(itemId: String, x: Float, y: Float, z: Float) async {
        guard let palace = currentPalace else { return }
        do {
            let updated = try await api.updateItemPosition(
                palaceId: palace.id, itemId: itemId, x: x, y: y, z: z
            )
            if let idx = items.firstIndex(where: { $0.id == itemId }) {
                items[idx] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func removeItem(itemId: String) async {
        guard let palace = currentPalace else { return }
        do {
            try await api.deleteItem(palaceId: palace.id, itemId: itemId)
            items.removeAll { $0.id == itemId }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Review

    func loadReviewItems() async {
        guard let palace = currentPalace else { return }
        do {
            reviewItems = try await api.getReviewItems(palaceId: palace.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func submitReview(itemId: String, quality: Int) async {
        guard let palace = currentPalace else { return }
        do {
            try await api.submitReview(palaceId: palace.id, itemId: itemId, quality: quality)
            reviewItems.removeAll { $0.id == itemId }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
