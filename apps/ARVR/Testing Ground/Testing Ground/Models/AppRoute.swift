import Foundation

enum AppRoute: Hashable {
    case home
    case palace
    case palaceSelect
    case palaceContent(palaceId: String)
    case profile
    case records
    case library
    case settings
    case scriptScenes(scriptId: String, scriptTitle: String)
}
