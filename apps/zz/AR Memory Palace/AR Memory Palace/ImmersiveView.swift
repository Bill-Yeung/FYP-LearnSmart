//
//  ImmersiveView.swift
//  AR Memory Palace
//
//  Created by itst on 26/1/2026.
//

import SwiftUI
import RealityKit
import RealityKitContent

struct ImmersiveView: View {

    @Environment(AppModel.self) var appModel
    @State private var rootEntity = Entity()
    
    // State to trigger object creation in the update closure
    @State private var newObject: (type: AppModel.ObjectType, position: SIMD3<Float>)?

    @State private var initialScale: SIMD3<Float>?
    @State private var initialOrientation: simd_quatf?

    var body: some View {
        RealityView { content, attachments in
            // Add a root entity to hold all placed objects
            content.add(rootEntity)
        } update: { content, attachments in
            if let newObject = newObject {
                let model: ModelEntity
                
                switch newObject.type {
                case .sphere:
                    let mesh = MeshResource.generateSphere(radius: 0.1)
                    let material = SimpleMaterial(color: .blue, isMetallic: true)
                    model = ModelEntity(mesh: mesh, materials: [material])
                case .cube:
                    let mesh = MeshResource.generateBox(size: 0.2)
                    let material = SimpleMaterial(color: .blue, isMetallic: true)
                    model = ModelEntity(mesh: mesh, materials: [material])
                case .flashCard:
                    // Create the flashcard body
                    model = ModelEntity(
                        mesh: .generateBox(width: 0.3, height: 0.2, depth: 0.01),
                        materials: [SimpleMaterial(color: .clear, isMetallic: false)]
                    )

                    // Add front text attachment
                    if let frontAttachment = attachments.entity(for: "front_text") {
                        frontAttachment.transform.translation = [0, 0, 0.005]
                        model.addChild(frontAttachment)
                    }

                    // Add back text attachment
                    if let backAttachment = attachments.entity(for: "back_text") {
                        backAttachment.transform.translation = [0, 0, -0.005]
                        backAttachment.transform.rotation = simd_quatf(angle: .pi, axis: [0, 1, 0])
                        model.addChild(backAttachment)
                    }
                }
                
                // Add collision and input components so it can be dragged later
                model.generateCollisionShapes(recursive: false)
                model.components.set(InputTargetComponent())
                
                // Place at the tapped location
                model.position = newObject.position
                
                rootEntity.addChild(model)
                
                // Reset the state to prevent creating more objects
                self.newObject = nil
            }
        } attachments: {
            Attachment(id: "front_text") {
                Text("Front")
                    .font(.largeTitle)
                    .frame(width: 280, height: 180)
                    .background(Color.white)
                    .foregroundColor(.black)
                    .cornerRadius(10)
            }
            Attachment(id: "back_text") {
                Text("Back")
                    .font(.largeTitle)
                    .frame(width: 280, height: 180)
                    .background(Color.white)
                    .foregroundColor(.black)
                    .cornerRadius(10)
            }
        }
        .overlay(alignment: .bottom) {
            Text("Selected Object: \(appModel.selectedObjectType.rawValue)")
                .padding()
                .background(.regularMaterial)
                .clipShape(Capsule())
                .padding()
        }
        // Place targeted gestures before the spatial tap gesture.
        .gesture(
            // Drag gesture to move existing objects
            DragGesture()
                .targetedToAnyEntity()
                .onChanged { value in
                    if let parent = value.entity.parent {
                        let newPosition = value.convert(value.location3D, from: .local, to: parent)
                        value.entity.position = SIMD3<Float>(newPosition)
                    }
                }
        )
        .gesture(
            MagnifyGesture()
                .targetedToAnyEntity()
                .onChanged { value in
                    if initialScale == nil {
                        initialScale = value.entity.scale
                    }
                    if let startScale = initialScale {
                        let magnification = Float(value.magnification)
                        value.entity.scale = startScale * magnification
                    }
                }
                .onEnded { _ in
                    initialScale = nil
                }
        )
        .gesture(
            RotateGesture3D()
                .targetedToAnyEntity()
                .onChanged { value in
                    if initialOrientation == nil {
                        initialOrientation = value.entity.orientation
                    }
                    if let startOrientation = initialOrientation {
                        value.entity.orientation = startOrientation * simd_quatf(value.rotation)
                    }
                }
                .onEnded { _ in
                    initialOrientation = nil
                }
        )
        .gesture(
            // Tap gesture to place new objects
            SpatialTapGesture()
                .onEnded { value in
                    newObject = (type: appModel.selectedObjectType, position: SIMD3<Float>(value.location3D))
                }
        )
    }
}

#Preview(immersionStyle: .full) {
    ImmersiveView()
        .environment(AppModel())
}