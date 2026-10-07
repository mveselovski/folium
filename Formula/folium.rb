class Folium < Formula
  desc "Local document browser for md, docx, xlsx, csv, html and txt files"
  homepage "https://github.com/mveselovski/folium"
  url "https://github.com/mveselovski/folium/archive/refs/tags/v0.1.1.tar.gz"
  sha256 "f643c39f692ee793c3df53a9527f1597d8df400d3e568d777d0b6ac1c0628a51"
  license "MIT"
  head "https://github.com/mveselovski/folium.git", branch: "main"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  service do
    run [opt_bin/"folium", "--port", "3000"]
    keep_alive true
    working_dir Dir.home
    log_path var/"log/folium.log"
    error_log_path var/"log/folium.log"
  end

  test do
    port = free_port
    pid = spawn bin/"folium", testpath, "--port", port.to_s
    sleep 3
    assert_match "<html", shell_output("curl -s http://localhost:#{port}/")
  ensure
    Process.kill("TERM", pid)
    Process.wait(pid)
  end
end
