import Foundation

/// Runs the bundled Node.js + folium.js server bound to 127.0.0.1.
final class ServerProcess {
    enum StartError: LocalizedError {
        case missingResources
        case exited(String)
        case timedOut

        var errorDescription: String? {
            switch self {
            case .missingResources: return "The app bundle is missing its server files. Try reinstalling Folium."
            case .exited(let log): return "The Folium server stopped unexpectedly.\n\n\(log)"
            case .timedOut: return "The Folium server did not start in time."
            }
        }
    }

    let port: UInt16
    var baseURL: URL { URL(string: "http://127.0.0.1:\(port)")! }

    private let process = Process()
    private let stdinPipe = Pipe()
    private let outputPipe = Pipe()
    private var output = Data()
    private let outputLock = NSLock()

    init(port: UInt16) {
        self.port = port
    }

    func start(folder: URL?) throws {
        let node = Bundle.main.bundleURL.appendingPathComponent("Contents/Helpers/node")
        guard
            FileManager.default.isExecutableFile(atPath: node.path),
            let script = Bundle.main.url(forResource: "folium", withExtension: "js", subdirectory: "server")
        else { throw StartError.missingResources }

        var args = [script.path, "--host", "127.0.0.1", "--port", String(port)]
        if let folder { args.insert(folder.path, at: 1) }

        process.executableURL = node
        process.arguments = args
        process.currentDirectoryURL = FileManager.default.homeDirectoryForCurrentUser
        var env = ProcessInfo.processInfo.environment
        env["FOLIUM_EXIT_ON_STDIN_EOF"] = "1"
        process.environment = env
        // Holding the write end open keeps the server alive; if the app dies, it closes and the server exits.
        process.standardInput = stdinPipe
        process.standardOutput = outputPipe
        process.standardError = outputPipe
        outputPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let chunk = handle.availableData
            guard let self, !chunk.isEmpty else { return }
            self.outputLock.lock()
            self.output.append(chunk)
            if self.output.count > 64_000 { self.output.removeFirst(self.output.count - 64_000) }
            self.outputLock.unlock()
        }
        try process.run()
    }

    var isRunning: Bool { process.isRunning }

    var recentOutput: String {
        outputLock.lock()
        defer { outputLock.unlock() }
        return String(decoding: output.suffix(4_000), as: UTF8.self)
    }

    /// Polls the server until it answers, or fails if the process exits first.
    /// The timeout is generous: a first launch can be slow while macOS scans or translates Node.
    func waitUntilReady(timeout: TimeInterval = 120) async throws {
        let deadline = Date().addingTimeInterval(timeout)
        let url = baseURL.appendingPathComponent("api/meta")
        while Date() < deadline {
            if !process.isRunning { throw StartError.exited(recentOutput) }
            if let (_, response) = try? await URLSession.shared.data(from: url),
               (response as? HTTPURLResponse)?.statusCode == 200 {
                return
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw StartError.timedOut
    }

    func setFolder(_ folder: URL) async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/setdir"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["path": folder.path])
        let (data, _) = try await URLSession.shared.data(for: request)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        if let error = json?["error"] as? String {
            throw NSError(domain: "Folium", code: 1, userInfo: [NSLocalizedDescriptionKey: error])
        }
    }

    func stop() {
        outputPipe.fileHandleForReading.readabilityHandler = nil
        guard process.isRunning else { return }
        process.terminate()
        let deadline = Date().addingTimeInterval(2)
        while process.isRunning && Date() < deadline { usleep(20_000) }
        if process.isRunning { kill(process.processIdentifier, SIGKILL) }
    }

    /// Reuses `preferred` when it is free so the web view's origin (and its saved
    /// theme and sort settings) stays the same across launches.
    static func pickPort(preferred: UInt16?) -> UInt16 {
        if let preferred, bind(port: preferred) != nil { return preferred }
        return bind(port: 0) ?? 48_213
    }

    private static func bind(port: UInt16) -> UInt16? {
        let fd = socket(AF_INET, SOCK_STREAM, 0)
        guard fd >= 0 else { return nil }
        defer { close(fd) }
        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = port.bigEndian
        addr.sin_addr.s_addr = inet_addr("127.0.0.1")
        let bound = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bound == 0 else { return nil }
        var len = socklen_t(MemoryLayout<sockaddr_in>.size)
        let named = withUnsafeMutablePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { getsockname(fd, $0, &len) }
        }
        guard named == 0 else { return nil }
        return UInt16(bigEndian: addr.sin_port)
    }
}
