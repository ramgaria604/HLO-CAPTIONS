import subprocess
import re
import time
import os

log_path = "cloudflared.log"
if os.path.exists(log_path):
    try:
        os.remove(log_path)
    except Exception:
        pass

print("Launching cloudflared...")
proc = subprocess.Popen(
    ["cloudflared.exe", "tunnel", "--url", "http://127.0.0.1:5000", "--logfile", log_path]
)

tunnel_url = None
for _ in range(30):
    time.sleep(1)
    if os.path.exists(log_path):
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            m = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", content)
            if m:
                tunnel_url = m.group(0)
                with open("tunnel_url.txt", "w", encoding="utf-8") as out:
                    out.write(tunnel_url + "\n")
                print(">>> PUBLIC PHONE ACCESS URL:", tunnel_url)
                break

proc.wait()
