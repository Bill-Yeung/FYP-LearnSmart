import SwiftUI

struct RemoteImageView: View {

    let url: URL?
    var placeholder: String = "photo"

    @State private var image: UIImage?
    @State private var isLoading = false

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else if isLoading {
                ProgressView()
            } else {
                Image(systemName: placeholder)
                    .font(.title2)
                    .foregroundStyle(.secondary)
            }
        }
        .task(id: url) {
            await loadImage()
        }
    }

    private func loadImage() async {
        guard let url else { return }
        isLoading = true
        defer { isLoading = false }
        image = try? await ImageCache.shared.image(for: url)
    }
}
