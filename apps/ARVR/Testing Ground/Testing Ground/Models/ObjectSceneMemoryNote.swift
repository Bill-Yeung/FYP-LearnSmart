import Foundation

/// Structured note connecting a placed object with scene context and memory content.
struct ObjectSceneMemoryNote: Codable, Equatable {
    var objectName: String
    var sceneContext: String
    var rememberContent: String

    init(objectName: String = "", sceneContext: String = "", rememberContent: String = "") {
        self.objectName = objectName
        self.sceneContext = sceneContext
        self.rememberContent = rememberContent
    }

    var isMeaningful: Bool {
        !rememberContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func toCustomText() -> String {
        let object = objectName.trimmingCharacters(in: .whitespacesAndNewlines)
        let scene = sceneContext.trimmingCharacters(in: .whitespacesAndNewlines)
        let remember = rememberContent.trimmingCharacters(in: .whitespacesAndNewlines)

        // Keep plain paragraphs plain so existing item text remains directly editable.
        if object.isEmpty && scene.isEmpty {
            return remember
        }

        return [
            "Object: \(object)",
            "Scene: \(scene)",
            "Remember: \(remember)",
        ].joined(separator: "\n\n")
    }

    static func from(customText: String?, fallbackObjectName: String?) -> ObjectSceneMemoryNote {
        guard let text = customText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return ObjectSceneMemoryNote(objectName: fallbackObjectName ?? "")
        }

        var objectName = fallbackObjectName ?? ""
        var sceneContext = ""
        var rememberContent = ""

        let lines = text.components(separatedBy: .newlines)
        for line in lines {
            if line.hasPrefix("Object:") {
                objectName = String(line.dropFirst("Object:".count)).trimmingCharacters(in: .whitespacesAndNewlines)
            } else if line.hasPrefix("Scene:") {
                sceneContext = String(line.dropFirst("Scene:".count)).trimmingCharacters(in: .whitespacesAndNewlines)
            } else if line.hasPrefix("Remember:") {
                rememberContent = String(line.dropFirst("Remember:".count)).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }

        if rememberContent.isEmpty {
            rememberContent = text.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        return ObjectSceneMemoryNote(
            objectName: objectName,
            sceneContext: sceneContext,
            rememberContent: rememberContent
        )
    }
}