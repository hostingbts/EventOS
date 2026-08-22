import Foundation

struct APIError: Error, LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

private struct ErrorEnvelope: Codable {
    var error: String?
}

/// Talks to the same Google Apps Script action-dispatch web app as web/src/api/client.ts.
/// Unlike the web client, there's no CORS to dodge here, so every write goes out as a
/// real HTTP POST (which satisfies both the GAS actions that accept GET+payload and the
/// ones — authLogin, commentAdd — that require a literal POST method server-side).
enum APIClient {
    private static let base = Secrets.apiURL
    private static let token = Secrets.apiToken

    private static func getURL(_ action: String, _ params: [String: String] = [:]) -> URL {
        var components = URLComponents(string: base)!
        var items = [URLQueryItem(name: "action", value: action), URLQueryItem(name: "token", value: token)]
        for (key, value) in params { items.append(URLQueryItem(name: key, value: value)) }
        components.queryItems = items
        return components.url!
    }

    static func get<T: Decodable>(_ action: String, _ params: [String: String] = [:]) async throws -> T {
        let (data, response) = try await URLSession.shared.data(from: getURL(action, params))
        return try decode(data, response)
    }

    static func post<T: Decodable>(_ action: String, _ body: [String: Any]) async throws -> T {
        var fullBody: [String: Any] = ["action": action, "token": token]
        for (key, value) in body { fullBody[key] = value }
        let payload = try JSONSerialization.data(withJSONObject: fullBody)

        var request = URLRequest(url: URL(string: base)!)
        request.httpMethod = "POST"
        request.setValue("text/plain;charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.httpBody = payload

        let (data, response) = try await URLSession.shared.data(for: request)
        return try decode(data, response)
    }

    private static func decode<T: Decodable>(_ data: Data, _ response: URLResponse) throws -> T {
        if let envelope = try? JSONDecoder().decode(ErrorEnvelope.self, from: data), let message = envelope.error {
            throw APIError(message: message)
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            let snippet = String(data: data.prefix(200), encoding: .utf8) ?? ""
            throw APIError(message: "Unexpected response: \(snippet)")
        }
    }
}
