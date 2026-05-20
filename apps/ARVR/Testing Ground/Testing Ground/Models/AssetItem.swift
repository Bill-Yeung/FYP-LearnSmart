import Foundation
import SwiftUI

struct AssetListResponse: Codable {
    let assets: [AssetItem]?
    let total: Int?
    let page: Int?
    let pageSize: Int?

    enum CodingKeys: String, CodingKey {
        case assets, total, page
        case pageSize = "page_size"
    }
}

struct AssetItem: Codable, Identifiable {
    let id: String
    let externalId: String?
    let name: String?
    let source: String?
    let assetType: String?
    let rawApiData: [String: AnyCodableValue]?
    let createdAt: String?
    let hasUSDZ: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, source
        case externalId = "external_id"
        case assetType = "asset_type"
        case rawApiData = "raw_api_data"
        case createdAt = "created_at"
        case hasUSDZ = "has_usdz"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        externalId = try c.decodeIfPresent(String.self, forKey: .externalId)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        source = try c.decodeIfPresent(String.self, forKey: .source)
        assetType = try c.decodeIfPresent(String.self, forKey: .assetType)
        rawApiData = try c.decodeIfPresent([String: AnyCodableValue].self, forKey: .rawApiData)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        hasUSDZ = (try? c.decode(Bool.self, forKey: .hasUSDZ)) ?? false
    }

    // MARK: - Thumbnail Helpers

    /// Extracts thumbnail URL from raw API data
    var thumbnailURL: URL? {
        // Try server-side thumbnail proxy first
        let baseURL = BackendConfig.baseURL
        if let proxy = URL(string: "\(baseURL)/api/models/\(id)/thumbnail") {
            return proxy
        }

        // Fallback to raw API data if proxy cannot be formed
        guard let rawData = rawApiData else { return nil }

        if let thumbString = rawData["thumbnail"]?.stringValue ?? rawData["thumbnail_url"]?.stringValue,
           let url = URL(string: thumbString) {
            return url
        }

        if let previewArray = rawData["preview"]?.arrayValue,
           let firstPreview = previewArray.first?.stringValue,
           let url = URL(string: firstPreview) {
            return url
        }

        if let imageString = rawData["image"]?.stringValue,
           let url = URL(string: imageString) {
            return url
        }

        return nil
    }

    /// Gets best resolution thumbnail (1k, 2k, etc.)
    func getThumbnailURL(preferredResolution: String = "1k") -> URL? {
        guard let rawData = rawApiData else { return thumbnailURL }

        // Try to find resolution-specific thumbnail
        if let thumbDict = rawData["thumbnails"]?.dictionaryValue,
           let resThumb = thumbDict[preferredResolution]?.stringValue,
           let url = URL(string: resThumb) {
            return url
        }

        return thumbnailURL
    }
}

/// Flexible JSON value wrapper for raw_api_data
enum AnyCodableValue: Codable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case object([String: AnyCodableValue])
    case array([AnyCodableValue])
    case null

    init(from decoder: Decoder) throws {
        if let container = try? decoder.container(keyedBy: JSONCodingKeys.self) {
            var dict = [String: AnyCodableValue]()
            for key in container.allKeys {
                if let value = try? container.decode(AnyCodableValue.self, forKey: key) {
                    dict[key.stringValue] = value
                }
            }
            self = .object(dict)
        } else if var container = try? decoder.unkeyedContainer() {
            var array = [AnyCodableValue]()
            while !container.isAtEnd {
                if let value = try? container.decode(AnyCodableValue.self) {
                    array.append(value)
                }
            }
            self = .array(array)
        } else {
            let container = try decoder.singleValueContainer()
            if let v = try? container.decode(Bool.self) { self = .bool(v) }
            else if let v = try? container.decode(Int.self) { self = .int(v) }
            else if let v = try? container.decode(Double.self) { self = .double(v) }
            else if let v = try? container.decode(String.self) { self = .string(v) }
            else { self = .null }
        }
    }

    func encode(to encoder: Encoder) throws {
        switch self {
        case .string(let v): var c = encoder.singleValueContainer(); try c.encode(v)
        case .int(let v): var c = encoder.singleValueContainer(); try c.encode(v)
        case .double(let v): var c = encoder.singleValueContainer(); try c.encode(v)
        case .bool(let v): var c = encoder.singleValueContainer(); try c.encode(v)
        case .object(let v): var c = encoder.container(keyedBy: JSONCodingKeys.self); for (k,val) in v { try c.encode(val, forKey: JSONCodingKeys(stringValue: k)!) }
        case .array(let v): var c = encoder.unkeyedContainer(); for val in v { try c.encode(val) }
        case .null: var c = encoder.singleValueContainer(); try c.encodeNil()
        }
    }

    // MARK: - Helpers

    var value: Any {
        switch self {
        case .string(let v): return v
        case .int(let v): return v
        case .double(let v): return v
        case .bool(let v): return v
        case .object(let v): return v.mapValues { $0.value }
        case .array(let v): return v.map { $0.value }
        case .null: return NSNull()
        }
    }

    var stringValue: String? {
        if case .string(let v) = self { return v }
        return nil
    }

    var arrayValue: [AnyCodableValue]? {
        if case .array(let v) = self { return v }
        return nil
    }

    var dictionaryValue: [String: AnyCodableValue]? {
        if case .object(let v) = self { return v }
        return nil
    }
}

struct JSONCodingKeys: CodingKey {
    var stringValue: String
    init?(stringValue: String) { self.stringValue = stringValue }
    var intValue: Int?
    init?(intValue: Int) { self.init(stringValue: "\(intValue)"); self.intValue = intValue }
}
