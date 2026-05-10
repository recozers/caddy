import SwiftUI
import Wearables

@main
struct CaddyAppApp: App {
    @StateObject private var wearables = WearablesController()

    init() {
        do {
            try Wearables.configure()
        } catch {
            assertionFailure("Wearables.configure failed: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(wearables)
                .onOpenURL { url in
                    // Meta AI deeplinks back to us after registration / permission flows.
                    Task {
                        do { _ = try await Wearables.shared.handleUrl(url) }
                        catch { print("handleUrl failed: \(error)") }
                    }
                }
        }
    }
}
