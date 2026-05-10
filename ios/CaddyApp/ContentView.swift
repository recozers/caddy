import SwiftUI

struct ContentView: View {
    @EnvironmentObject var wearables: WearablesController

    @State private var lie = "fairway"
    @State private var distance = 155
    @State private var elevation = 0
    @State private var wind = "light"
    @State private var windDir = "into"
    @State private var tempF = 68
    @State private var bag = "driver, 3w, 4h, 5-PW, 52, 56, 60, putter"

    @State private var advice: String = ""
    @State private var thinking = false
    @State private var lastError: String?

    private let lies = ["tee", "fairway", "light rough", "heavy rough", "fairway bunker", "greenside bunker", "green"]
    private let winds = ["calm", "light", "moderate", "strong"]
    private let dirs = ["into", "downwind", "left-to-right", "right-to-left", "crosswind"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Glasses") {
                    Text("Status: \(statusText)").font(.subheadline)
                    if !wearables.hasDevice {
                        Button("Pair with Meta AI app") { wearables.register() }
                    } else {
                        Button("Start camera stream") { Task { await wearables.startStream() } }
                            .disabled(wearables.status == .streaming)
                    }
                }

                Section("Shot") {
                    Picker("Lie", selection: $lie) { ForEach(lies, id: \.self) { Text($0) } }
                    Stepper("Distance: \(distance) y", value: $distance, in: 30...350)
                    Stepper("Elevation: \(elevation) ft", value: $elevation, in: -50...50)
                }

                Section("Conditions") {
                    Picker("Wind", selection: $wind) { ForEach(winds, id: \.self) { Text($0) } }
                    Picker("Direction", selection: $windDir) { ForEach(dirs, id: \.self) { Text($0) } }
                    Stepper("Temperature: \(tempF)°F", value: $tempF, in: 20...110)
                }

                Section("Bag") {
                    TextField("Bag", text: $bag, axis: .vertical)
                }

                Section {
                    Button(thinking ? "Thinking…" : "Ask caddy") { Task { await askCaddy() } }
                        .disabled(wearables.status != .streaming || thinking)
                }

                if !advice.isEmpty {
                    Section("Caddy") { Text(advice).font(.body) }
                }
                if let err = lastError {
                    Section("Error") { Text(err).foregroundStyle(.red) }
                }
            }
            .navigationTitle("AI Caddy")
        }
    }

    private var statusText: String {
        switch wearables.status {
        case .idle:        return "idle"
        case .registering: return "registering — confirm in Meta AI app"
        case .ready:       return wearables.hasDevice ? "device available" : "no device"
        case .streaming:   return "streaming"
        case .error(let s): return "error: \(s)"
        }
    }

    private func askCaddy() async {
        lastError = nil
        thinking = true
        defer { thinking = false }
        do {
            let jpeg = try await wearables.capturePhoto()
            let cond = CaddyClient.Conditions(
                lie: lie, distance: distance, elevation: elevation,
                wind: wind, windDir: windDir, tempF: tempF, bag: bag
            )
            let text = try await CaddyClient.shared.askCaddy(jpeg: jpeg, conditions: cond)
            advice = text
            CaddyClient.shared.speak(text)
        } catch {
            lastError = String(describing: error)
        }
    }
}

#Preview {
    ContentView().environmentObject(WearablesController())
}
