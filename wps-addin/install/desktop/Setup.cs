using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class SetupProgram {
    internal static JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 16000000 };
    [STAThread] static int Main(string[] args) {
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        try {
            if ((args.Length == 2 && args[0] == "--render") || (args.Length == 3 && args[0] == "--render-state")) {
                using (var form = new SetupForm()) { if (args[0] == "--render") form.LoadPreview(); else form.LoadState(Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(args[1]))); form.Show(); Application.DoEvents(); using (var bmp = new Bitmap(form.Width, form.Height)) { form.DrawToBitmap(bmp, new Rectangle(0, 0, form.Width, form.Height)); bmp.Save(args[args.Length - 1]); } }
                return 0;
            }
            if (args.Length == 2 && args[0] == "--verify-package") {
                var root = Extract();
                try { File.WriteAllText(args[1], Run(root, "inspect", null).Result, new UTF8Encoding(false)); }
                finally { Directory.Delete(root, true); }
                return 0;
            }
            Application.Run(new SetupForm()); return 0;
        } catch (Exception e) { MessageBox.Show(e.GetBaseException().Message, "材料整理助手安装程序", MessageBoxButtons.OK, MessageBoxIcon.Error); return 1; }
    }
    internal static string Extract() {
        if (!Environment.Is64BitOperatingSystem) throw new Exception("此安装包适用于 64 位 Windows，请使用匹配的安装包。");
        var root = Path.Combine(Path.GetTempPath(), "rfq-" + Guid.NewGuid().ToString("N").Substring(0, 10));
        var drive = new DriveInfo(Path.GetPathRoot(root));
        if (drive.AvailableFreeSpace < 1200L * 1024 * 1024) throw new Exception("临时目录所在磁盘空间不足，请至少保留 1.2 GB 后重试。");
        Directory.CreateDirectory(root);
        try {
            var assembly = Assembly.GetExecutingAssembly();
            string wanted; using (var r = new StreamReader(assembly.GetManifestResourceStream("Payload.sha256"))) wanted = r.ReadToEnd().Trim();
            using (var stream = assembly.GetManifestResourceStream("Payload.zip")) {
                if (stream == null) throw new Exception("安装包不完整，请重新下载。");
                string hash; using (var sha = SHA256.Create()) hash = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
                if (hash != wanted) throw new Exception("安装包校验失败，请重新下载。");
                stream.Position = 0;
                using (var zip = new ZipArchive(stream, ZipArchiveMode.Read)) {
                    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    foreach (var entry in zip.Entries) {
                        var target = Path.GetFullPath(Path.Combine(root, entry.FullName.Replace('/', Path.DirectorySeparatorChar)));
                        if (!target.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || !seen.Add(target)) throw new Exception("安装包文件路径无效。");
                        if (String.IsNullOrEmpty(entry.Name)) { Directory.CreateDirectory(target); continue; }
                        Directory.CreateDirectory(Path.GetDirectoryName(target)); entry.ExtractToFile(target, false);
                    }
                }
            }
            return root;
        } catch { Directory.Delete(root, true); throw; }
    }
    internal static async Task<string> Run(string root, string mode, Action<string> onLine) {
        var engine = Path.Combine(root, "app", "install", "desktop", "engine.cjs");
        var info = new ProcessStartInfo(Path.Combine(root, "runtime", "node", "node.exe"), Quote(engine) + " " + mode) {
            UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8, WorkingDirectory = root
        };
        using (var p = new Process { StartInfo = info }) {
            p.Start(); var errors = p.StandardError.ReadToEndAsync(); var output = new StringBuilder();
            string line; while ((line = await p.StandardOutput.ReadLineAsync().ConfigureAwait(false)) != null) { output.AppendLine(line); if (onLine != null) onLine(line); }
            await Task.Run(() => p.WaitForExit()).ConfigureAwait(false);
            var stderr = await errors.ConfigureAwait(false);
            if (p.ExitCode != 0) {
                var message = output.ToString().Trim();
                try { var last = message.Split(new[] { '\n' }, StringSplitOptions.RemoveEmptyEntries); var obj = Json.Deserialize<Dictionary<string, object>>(last[last.Length - 1]); message = Convert.ToString(obj["message"]); } catch { }
                throw new Exception(String.IsNullOrEmpty(message) ? stderr : message);
            }
            return output.ToString();
        }
    }
    internal static string Quote(string value) { return "\"" + value.Replace("\"", "\\\"") + "\""; }
}

internal sealed class SetupForm : Form {
    private Label subtitle, node, shell, wps, status, steps;
    private Button install, retry, website, close;
    private CheckBox accept;
    private ProgressBar progress;
    private TextBox details;
    private string root, wpsPath;
    private bool busy, complete, preview, ready, unverified;
    internal SetupForm() {
        Text = "材料整理助手 · 安装程序"; ClientSize = new Size(660, 565); MinimumSize = new Size(676, 604);
        FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Microsoft YaHei UI", 10); BackColor = Color.FromArgb(246, 248, 250); AutoScaleMode = AutoScaleMode.Dpi;
        var header = new Panel { BackColor = Color.White, Dock = DockStyle.Top, Height = 112 }; Controls.Add(header);
        var title = MakeLabel("材料整理助手", 28, 18, 580, 38, 22, true); header.Controls.Add(title);
        subtitle = MakeLabel("安装向导  ·  运行环境随包提供，无需输入命令", 30, 65, 590, 28, 10, false); header.Controls.Add(subtitle);
        steps = MakeLabel("① 环境检测      →      ② 一键安装      →      ③ 完成", 30, 130, 600, 25, 11, true); Controls.Add(steps);
        var card = new Panel { BackColor = Color.White, Location = new Point(30, 170), Size = new Size(600, 127) }; Controls.Add(card);
        node = MakeLabel("○ Node.js            等待检查内置运行环境", 18, 13, 565, 28, 10, false); card.Controls.Add(node);
        shell = MakeLabel("○ PowerShell       等待检查内置运行环境", 18, 50, 565, 28, 10, false); card.Controls.Add(shell);
        wps = MakeLabel("○ WPS 表格         等待检测", 18, 87, 565, 28, 10, false); card.Controls.Add(wps);
        status = MakeLabel("正在准备安装，请稍候…", 30, 309, 600, 49, 10, false); Controls.Add(status);
        accept = new CheckBox { Text = "我已了解：当前 WPS 版本尚未验证兼容性，仍继续安装", Location = new Point(30, 356), Size = new Size(600, 30), Visible = false };
        accept.CheckedChanged += (s, e) => UpdateInstall(); Controls.Add(accept);
        progress = new ProgressBar { Location = new Point(30, 394), Size = new Size(600, 8), Style = ProgressBarStyle.Marquee, MarqueeAnimationSpeed = 25 }; Controls.Add(progress);
        details = new TextBox { Location = new Point(30, 417), Size = new Size(600, 63), Multiline = true, ReadOnly = true, TabStop = false, ScrollBars = ScrollBars.Vertical, BorderStyle = BorderStyle.None, BackColor = BackColor, Text = "将安装到当前用户目录。升级保留项目、分类库和抬头模板。" }; Controls.Add(details);
        website = MakeButton("安装 WPS", 30, 505, 110, false); website.Click += (s, e) => Open("https://www.wps.cn/"); website.Visible = false; Controls.Add(website);
        retry = MakeButton("重新检测", 155, 505, 110, false); retry.Click += async (s, e) => await Detect(); retry.Enabled = false; Controls.Add(retry);
        close = MakeButton("退出", 390, 505, 90, false); close.Click += (s, e) => Close(); Controls.Add(close);
        install = MakeButton("一键安装", 495, 505, 135, true); install.Enabled = false; install.Click += async (s, e) => { if (complete) { if (!String.IsNullOrEmpty(wpsPath)) Open(wpsPath); Close(); } else await Install(); }; Controls.Add(install);
        Shown += async (s, e) => { if (!preview) await Detect(); };
        FormClosing += (s, e) => { if (busy) { e.Cancel = true; return; } if (!String.IsNullOrEmpty(root)) { try { Directory.Delete(root, true); } catch { } } };
    }
    private Label MakeLabel(string text, int x, int y, int width, int height, float size, bool bold) { return new Label { Text = text, Location = new Point(x, y), Size = new Size(width, height), Font = new Font("Microsoft YaHei UI", size, bold ? FontStyle.Bold : FontStyle.Regular), ForeColor = Color.FromArgb(30, 45, 55) }; }
    private Button MakeButton(string text, int x, int y, int width, bool primary) { return new Button { Text = text, Location = new Point(x, y), Size = new Size(width, 38), FlatStyle = FlatStyle.Flat, BackColor = primary ? Color.FromArgb(17, 133, 84) : Color.White, ForeColor = primary ? Color.White : Color.FromArgb(30, 45, 55), Cursor = Cursors.Hand }; }
    private void Open(string target) { try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); } catch (Exception e) { MessageBox.Show(this, e.Message, "无法打开"); } }
    private void UpdateInstall() { if (install == null) return; install.Enabled = !busy && ready && (!unverified || accept.Checked); install.BackColor = install.Enabled ? Color.FromArgb(17, 133, 84) : Color.FromArgb(218, 225, 223); install.ForeColor = install.Enabled ? Color.White : Color.Gray; }
    private void Busy(bool value) { busy = value; retry.Enabled = !value; close.Enabled = !value; UpdateInstall(); progress.Style = value ? ProgressBarStyle.Marquee : ProgressBarStyle.Blocks; }
    private async Task Detect() {
        Busy(true); status.Text = "正在检测环境…";
        try {
            if (root == null) root = await Task.Run(() => SetupProgram.Extract());
            var output = await SetupProgram.Run(root, "inspect", null);
            var result = SetupProgram.Json.Deserialize<Dictionary<string, object>>(output.Trim());
            ApplyEnvironment(result);
        } catch (Exception e) { ready = false; status.Text = "环境检查未完成，请查看下方原因。"; details.Text = e.GetBaseException().Message; }
        finally { Busy(false); }
    }
    private void ApplyEnvironment(Dictionary<string, object> result) {
            ready = Convert.ToBoolean(result["ready"]);
            node.Text = "✓ Node.js " + result["node"] + "    已内置，无需另外安装";
            shell.Text = "✓ PowerShell " + result["powershell"] + "    已内置，无需另外安装";
            wpsPath = result.ContainsKey("wpsPath") ? Convert.ToString(result["wpsPath"]) : null;
            wps.Text = String.IsNullOrEmpty(wpsPath) ? "○ WPS 表格    尚未安装" : "✓ WPS 表格 " + result["wpsVersion"];
            website.Visible = String.IsNullOrEmpty(wpsPath);
            unverified = Convert.ToBoolean(result["requiresConfirmation"]); accept.Visible = unverified; accept.Checked = false;
            var reasons = new List<string>(); var list = result["reasons"] as System.Collections.IEnumerable;
            if (list != null) foreach (var item in list) reasons.Add(Convert.ToString(item));
            status.Text = !ready ? String.Join("\r\n", reasons.ToArray()) : unverified ? "当前 WPS 版本未验证。已验证版本：12.1.0.29161。" : "环境检测通过，可以安装。";
            install.Text = Convert.ToBoolean(result["installed"]) ? "升级 / 修复" : "一键安装";
            details.Text = "安装位置：" + Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WpsRfqAddin") + "\r\n升级保留项目和成果；请先保存文件并关闭 WPS。";
    }
    private async Task Install() {
        Busy(true); accept.Enabled = false; steps.Text = "✓ 环境检测      →      ② 正在安装      →      ③ 完成";
        try {
            await SetupProgram.Run(root, "install" + (unverified && accept.Checked ? " --accept-unverified" : ""), line => {
                try { var obj = SetupProgram.Json.Deserialize<Dictionary<string, object>>(line); if (obj.ContainsKey("message")) BeginInvoke((Action)(() => status.Text = Convert.ToString(obj["message"]))); } catch { }
            });
            complete = true; ready = true; steps.Text = "✓ 环境检测      →      ✓ 安装完成";
            status.Text = "安装成功。打开 WPS 表格后，在顶部“材料整理”中打开助手。";
            details.Text = "以后可双击桌面“材料整理助手”启动。\r\n专用运行环境已保存，重新开机后仍可使用。";
            retry.Visible = false; website.Visible = false; accept.Visible = false; unverified = false; install.Text = "打开 WPS"; progress.Value = 100;
        } catch (Exception e) { ready = false; status.Text = "安装未完成，请查看下方原因。"; details.Text = e.GetBaseException().Message; retry.Visible = true; }
        finally { Busy(false); accept.Enabled = true; }
    }
    internal void LoadPreview() {
        preview = true; ready = true; node.Text = "✓ Node.js 22.23.3    已内置，无需另外安装"; shell.Text = "✓ PowerShell 7.6.7    已内置，无需另外安装";
        wps.Text = "✓ WPS 表格 12.1.0.29161    已检测到"; status.Text = "环境检测通过，可以安装。"; progress.Style = ProgressBarStyle.Blocks; retry.Enabled = true; install.Enabled = true;
    }
    internal void LoadState(Dictionary<string, object> state) { preview = true; ApplyEnvironment(state); Busy(false); }
}
