import Foundation

struct AssetItem: Codable, Identifiable {
    let id: String
    let externalId: String?
    let name: String
    let source: String?
    let assetType: String?
    let rawApiData: [String: AnyCodableValue]?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name, source
        case externalId = "external_id"
        case assetType = "asset_type"
        case rawApiData = "raw_api_data"
        case createdAt = "created_at"
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
        let container = try decoder.singleValueContainer()
        if let v = try? container.decode(Bool.self) { self = .bool(v) }
        else if let v = try? container.decode(Int.self) { self = .int(v) }
        else if let v = try? container.decode(Double.self) { self = .double(v) }
        else if let v = try? container.decode(String.self) { self = .string(v) }
        else if let v = try? container.decode([String: AnyCodableValue].self) { self = .object(v) }
        else if let v = try? container.decode([AnyCodableValue].self) { self = .array(v) }
        else { self = .null }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let v): try container.encode(v)
        case .int(let v): try container.encode(v)
        case .double(let v): try container.encode(v)
        case .bool(let v): try container.encode(v)
        case .object(let v): try container.encode(v)
        case .array(let v): try container.encode(v)
        case .null: try container.encodeNil()
        }
    }
}
