import AppKit
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private enum Defaults {
        static let folder = "folder"
        static let port = "port"
    }

    private var server: ServerProcess?
    private var window: NSWindow?
    private var webView: WKWebView?
    private var pendingFolder: URL?
    private var isServerReady = false

    // MARK: - Lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.mainMenu = MainMenu.build()
        createWindow()
        startServer()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        server?.stop()
    }

    /// Folders dropped on the Dock icon or opened with "Open With → Folium".
    func application(_ application: NSApplication, open urls: [URL]) {
        guard let folder = urls.first(where: \.hasDirectoryPath) else { return }
        useFolder(folder)
    }

    // MARK: - Server

    private func startServer() {
        let defaults = UserDefaults.standard
        let savedPort = defaults.object(forKey: Defaults.port) as? Int
        let port = ServerProcess.pickPort(preferred: savedPort.flatMap { UInt16(exactly: $0) })
        defaults.set(Int(port), forKey: Defaults.port)

        let folder = pendingFolder ?? savedFolder()
        pendingFolder = nil
        if let folder { defaults.set(folder.path, forKey: Defaults.folder) }
        updateTitle(folder: folder)

        let server = ServerProcess(port: port)
        self.server = server
        showStartingPage()
        Task { @MainActor in
            do {
                try server.start(folder: folder)
                try await server.waitUntilReady()
                isServerReady = true
                webView?.load(URLRequest(url: server.baseURL))
            } catch {
                showFatalError(error)
            }
        }
    }

    private func savedFolder() -> URL? {
        guard let path = UserDefaults.standard.string(forKey: Defaults.folder) else { return nil }
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: path, isDirectory: &isDir), isDir.boolValue else { return nil }
        return URL(fileURLWithPath: path, isDirectory: true)
    }

    private func useFolder(_ folder: URL) {
        // Folders chosen while the server is still starting are applied once the page loads.
        guard let server, isServerReady else {
            pendingFolder = folder
            updateTitle(folder: folder)
            return
        }
        Task { @MainActor in
            do {
                try await server.setFolder(folder)
                UserDefaults.standard.set(folder.path, forKey: Defaults.folder)
                updateTitle(folder: folder)
                _ = try? await webView?.evaluateJavaScript("loadTree()")
            } catch {
                let alert = NSAlert(error: error)
                if let window { alert.beginSheetModal(for: window, completionHandler: nil) } else { alert.runModal() }
            }
        }
    }

    /// Shown until the server answers; the first launch can take a while
    /// (Gatekeeper's first-run scan, or Rosetta translating Node on Apple silicon).
    private func showStartingPage() {
        webView?.loadHTMLString("""
            <html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
              font:13px -apple-system,sans-serif;color:#888;background:Canvas;color-scheme:light dark">
            Starting Folium…</body></html>
            """, baseURL: nil)
    }

    private func showFatalError(_ error: Error) {
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = "Folium couldn't start"
        alert.informativeText = error.localizedDescription
        alert.addButton(withTitle: "Quit")
        alert.runModal()
        NSApp.terminate(nil)
    }

    // MARK: - Window

    private func createWindow() {
        let config = WKWebViewConfiguration()
        config.userContentController.add(ScriptMessageProxy(self), name: "folium")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsMagnification = true
        #if DEBUG
        webView.isInspectable = true
        #endif
        self.webView = webView

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1200, height: 800),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Folium"
        window.minSize = NSSize(width: 640, height: 400)
        window.contentView = webView
        window.center()
        window.setFrameAutosaveName("FoliumMainWindow")
        window.tabbingMode = .disallowed
        window.isReleasedWhenClosed = false
        window.makeKeyAndOrderFront(nil)
        self.window = window
        NSApp.activate(ignoringOtherApps: true)
    }

    private func updateTitle(folder: URL?) {
        window?.title = folder?.lastPathComponent ?? "Folium"
        window?.subtitle = folder.map { ($0.path as NSString).abbreviatingWithTildeInPath } ?? ""
    }

    // MARK: - Menu actions

    @objc func openFolder(_ sender: Any?) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.prompt = "Open"
        panel.message = "Choose a folder of documents to browse"
        panel.directoryURL = savedFolder() ?? FileManager.default.homeDirectoryForCurrentUser
        let handle: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            self?.useFolder(url)
        }
        if let window { panel.beginSheetModal(for: window, completionHandler: handle) } else { handle(panel.runModal()) }
    }

    @objc func reloadPage(_ sender: Any?) { webView?.reload() }
    @objc func zoomIn(_ sender: Any?) { webView?.pageZoom += 0.1 }
    @objc func zoomOut(_ sender: Any?) { webView.map { $0.pageZoom = max(0.5, $0.pageZoom - 0.1) } }
    @objc func actualSize(_ sender: Any?) { webView?.pageZoom = 1 }

    @objc func showHelp(_ sender: Any?) {
        NSWorkspace.shared.open(URL(string: "https://github.com/mveselovski/folium")!)
    }
}

// MARK: - Web view delegates

extension AppDelegate: WKNavigationDelegate, WKUIDelegate {
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }
        let isServer = url.host == "127.0.0.1" && url.port.map(UInt16.init) == server?.port
        let isLocal = isServer || url.scheme == "about" || url.scheme == "data" || url.scheme == "blob"
        // Links clicked to anywhere other than the Folium server open in the default browser.
        if navigationAction.navigationType == .linkActivated && !isLocal {
            NSWorkspace.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    /// target="_blank" links and window.open() go to the default browser.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if let folder = pendingFolder {
            pendingFolder = nil
            useFolder(folder)
        }
    }
}

extension AppDelegate {
    func handleScriptMessage(_ message: WKScriptMessage) {
        if message.body as? String == "pickFolder" { openFolder(nil) }
    }
}

/// Avoids the retain cycle WKUserContentController would create with the delegate.
private final class ScriptMessageProxy: NSObject, WKScriptMessageHandler {
    weak var target: AppDelegate?
    init(_ target: AppDelegate) { self.target = target }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.handleScriptMessage(message)
    }
}
