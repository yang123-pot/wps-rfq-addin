using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class Launcher {
    [STAThread] static int Main(string[] args) {
        try {
            var root = AppDomain.CurrentDomain.BaseDirectory;
            var config = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(root, "config.json")));
            var info = new ProcessStartInfo(Convert.ToString(config["node"]), "\"" + Path.Combine(root, "engine.cjs") + "\" start") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8 };
            using (var process = Process.Start(info)) {
                var errors = process.StandardError.ReadToEndAsync(); var output = process.StandardOutput.ReadToEnd(); process.WaitForExit();
                if (process.ExitCode != 0) throw new Exception(output + errors.Result);
            }
            if (Array.IndexOf(args, "--background") < 0) {
                var installation = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(Convert.ToString(config["data"]), "installation.json")));
                Process.Start(new ProcessStartInfo(Convert.ToString(installation["wpsPath"])) { UseShellExecute = true });
            }
            return 0;
        } catch (Exception e) { MessageBox.Show("材料整理助手启动失败：\r\n" + e.GetBaseException().Message + "\r\n请重新运行安装程序修复。", "材料整理助手", MessageBoxButtons.OK, MessageBoxIcon.Warning); return 1; }
    }
}
