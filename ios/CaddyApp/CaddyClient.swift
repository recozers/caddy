import Foundation
import AVFoundation

/// Calls the /api/caddy backend with a JPEG + conditions, then speaks the reply.
/// Audio routes to the glasses speakers automatically when they're the active BT output device.
final class CaddyClient {
    static let shared = CaddyClient()
    private let synth = AVSpeechSynthesizer()

    /// Edit this to your deployed backend, or your local tunnel URL.
    /// In dev: `cloudflared tunnel --url http://localhost:3000`.
    var baseURL = URL(string: "https://YOUR-TUNNEL.trycloudflare.com")!

    struct Conditions: Codable {
        var lie: String
        var distance: Int
        var elevation: Int
        var wind: String
        var windDir: String
        var tempF: Int
        var bag: String
    }

    func askCaddy(jpeg: Data, conditions: Conditions) async throws -> String {
        let dataURL = "data:image/jpeg;base64,\(jpeg.base64EncodedString())"
        let body: [String: Any] = [
            "image": dataURL,
            "voice": true,   // glasses TTS — keep replies under ~25 words
            "conditions": [
                "lie": conditions.lie,
                "distance": conditions.distance,
                "elevation": conditions.elevation,
                "wind": conditions.wind,
                "windDir": conditions.windDir,
                "tempF": conditions.tempF,
                "bag": conditions.bag,
            ],
        ]

        var req = URLRequest(url: baseURL.appendingPathComponent("api/caddy"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        req.timeoutInterval = 30

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NSError(domain: "Caddy", code: 2, userInfo: [NSLocalizedDescriptionKey: "Backend error"])
        }
        let parsed = try JSONDecoder().decode(Reply.self, from: data)
        return parsed.advice
    }

    func speak(_ text: String) {
        // Route audio to the BT-connected glasses speakers when active.
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.allowBluetoothA2DP, .allowBluetooth])
        try? AVAudioSession.sharedInstance().setActive(true)
        synth.stopSpeaking(at: .immediate)
        let utt = AVSpeechUtterance(string: text)
        utt.rate = 0.52
        synth.speak(utt)
    }

    private struct Reply: Decodable { let advice: String }
}
