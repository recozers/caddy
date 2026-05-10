import Foundation
import Combine
import Wearables

/// Owns all interaction with the Meta Wearables Device Access Toolkit.
/// Exposes a tiny surface to SwiftUI: register, start a stream, capture a photo.
@MainActor
final class WearablesController: ObservableObject {
    enum Status: Equatable {
        case idle
        case registering
        case ready
        case streaming
        case error(String)
    }

    @Published var status: Status = .idle
    @Published var hasDevice: Bool = false

    private let wearables = Wearables.shared
    private var session: Session?
    private var stream: StreamSession?
    private var listenTokens: [Any] = []
    private var devicesTask: Task<Void, Never>?
    private var photoContinuation: CheckedContinuation<Data, Error>?

    // MARK: - Registration

    /// Triggers the Meta AI deeplink to pair this app with the user's glasses.
    /// One-time per app install.
    func register() {
        do {
            status = .registering
            try wearables.startRegistration()
            observeDevices()
        } catch {
            status = .error("startRegistration failed: \(error)")
        }
    }

    private func observeDevices() {
        devicesTask?.cancel()
        devicesTask = Task { [weak self] in
            guard let self else { return }
            for await devices in self.wearables.devicesStream() {
                await MainActor.run { self.hasDevice = !devices.isEmpty }
            }
        }
    }

    // MARK: - Permission + stream lifecycle

    func startStream() async {
        do {
            // Glasses won't appear in devicesStream until at least one permission is granted.
            let camStatus = try await wearables.requestPermission(.camera)
            guard camStatus == .granted else {
                status = .error("Camera permission: \(camStatus)")
                return
            }

            let selector = AutoDeviceSelector(wearables: wearables)
            let session = try wearables.createSession(deviceSelector: selector)
            try session.start()
            self.session = session

            let config = StreamSessionConfig(
                videoCodec: .raw,
                resolution: .low,        // 360x640 — plenty for a single still
                frameRate: 24
            )
            guard let stream = try? session.addStream(config: config) else {
                status = .error("addStream returned nil")
                return
            }
            self.stream = stream

            listenTokens.append(stream.statePublisher.listen { state in
                Task { @MainActor in
                    switch state {
                    case .streaming: self.status = .streaming
                    case .stopped:   self.status = .ready
                    default:         break
                    }
                }
            })

            listenTokens.append(stream.photoDataPublisher.listen { photoData in
                Task { @MainActor in
                    let data = photoData.data
                    self.photoContinuation?.resume(returning: data)
                    self.photoContinuation = nil
                }
            })

            await stream.start()
        } catch {
            status = .error("startStream: \(error)")
        }
    }

    /// Capture a single JPEG from the live stream.
    func capturePhoto() async throws -> Data {
        guard let stream else { throw NSError(domain: "Caddy", code: 1, userInfo: [NSLocalizedDescriptionKey: "No active stream"]) }
        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Data, Error>) in
            self.photoContinuation = cont
            stream.capturePhoto(format: .jpeg)
        }
    }

    func stop() {
        listenTokens.removeAll()
        Task { await stream?.stop() }
        try? session?.stop()
        session = nil
        stream = nil
        status = .idle
    }
}
