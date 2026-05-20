//
// SceneController.swift
// Testing Ground
//
// Created by copilot on 10/2/2026.
//

import Foundation
import RealityKit

@MainActor
final class SceneController {
    static let shared = SceneController()

    private var addHandler: ((Entity) -> Void)?

    private init() {}

    func registerAddHandler(_ handler: @escaping (Entity) -> Void) {
        addHandler = handler
    }

    func unregisterAddHandler() {
        addHandler = nil
    }

    func addEntity(_ entity: Entity) {
        addHandler?(entity)
    }
}
