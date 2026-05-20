import RealityKit

/// Component that marks an entity as an interactive memory palace item.
struct HighlightComponent: Component {
    var itemId: String
    var label: String?
    var flashcardId: String?
    var assetId: String?
    var displayType: String = "card"
    var isSelected: Bool = false
}

/// System that handles highlight state for palace items.
/// Entities with HighlightComponent can be selected via gaze/tap.
struct HighlightSystem: System {

    static let query = EntityQuery(where: .has(HighlightComponent.self))

    init(scene: RealityKit.Scene) {}

    func update(context: SceneUpdateContext) {
        for entity in context.entities(matching: Self.query, updatingSystemWhen: .rendering) {
            guard let highlight = entity.components[HighlightComponent.self] else { continue }

            // Visual feedback based on selection state
            if highlight.isSelected {
                if entity.components[OpacityComponent.self] == nil {
                    entity.components.set(OpacityComponent(opacity: 0.9))
                }
            } else {
                entity.components.remove(OpacityComponent.self)
            }

            entity.components.set(highlight)
        }
    }
}
