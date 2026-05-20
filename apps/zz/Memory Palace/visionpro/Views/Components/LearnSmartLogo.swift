import SwiftUI

/// LearnSmart logo — stacked layers design matching the web app favicon.
struct LearnSmartLogo: View {

    var size: CGFloat = 32
    var color: Color = Brand.primary

    var body: some View {
        Canvas { context, canvasSize in
            let scale = canvasSize.width / 24
            let strokeStyle = StrokeStyle(lineWidth: 2 * scale, lineCap: .round, lineJoin: .round)

            // Three stacked diamond/layer shapes
            // Top layer
            var topPath = Path()
            topPath.move(to: CGPoint(x: 12 * scale, y: 2 * scale))
            topPath.addLine(to: CGPoint(x: 2 * scale, y: 7 * scale))
            topPath.addLine(to: CGPoint(x: 12 * scale, y: 12 * scale))
            topPath.addLine(to: CGPoint(x: 22 * scale, y: 7 * scale))
            topPath.closeSubpath()
            context.stroke(topPath, with: .color(color), style: strokeStyle)

            // Middle layer
            var midPath = Path()
            midPath.move(to: CGPoint(x: 2 * scale, y: 12 * scale))
            midPath.addLine(to: CGPoint(x: 12 * scale, y: 17 * scale))
            midPath.addLine(to: CGPoint(x: 22 * scale, y: 12 * scale))
            context.stroke(midPath, with: .color(color), style: strokeStyle)

            // Bottom layer
            var bottomPath = Path()
            bottomPath.move(to: CGPoint(x: 2 * scale, y: 17 * scale))
            bottomPath.addLine(to: CGPoint(x: 12 * scale, y: 22 * scale))
            bottomPath.addLine(to: CGPoint(x: 22 * scale, y: 17 * scale))
            context.stroke(bottomPath, with: .color(color), style: strokeStyle)
        }
        .frame(width: size, height: size)
    }
}

/// Full branded header with logo + app name.
struct LearnSmartHeader: View {

    var size: HeaderSize = .large

    enum HeaderSize {
        case small, medium, large
    }

    var body: some View {
        HStack(spacing: logoSpacing) {
            LearnSmartLogo(size: logoSize, color: Brand.primary)
            Text("LearnSmart")
                .font(titleFont)
                .fontWeight(.bold)
                .foregroundStyle(.primary)
        }
    }

    private var logoSize: CGFloat {
        switch size {
        case .small: return 24
        case .medium: return 32
        case .large: return 40
        }
    }

    private var logoSpacing: CGFloat {
        switch size {
        case .small: return 6
        case .medium: return 8
        case .large: return 10
        }
    }

    private var titleFont: Font {
        switch size {
        case .small: return .title3
        case .medium: return .title2
        case .large: return .largeTitle
        }
    }
}
