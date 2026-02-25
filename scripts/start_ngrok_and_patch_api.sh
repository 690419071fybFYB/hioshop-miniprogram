#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_FILE="$ROOT_DIR/config/api.js"
PORT="${1:-8360}"
NGROK_LOG="/tmp/hioshop_ngrok.log"
TUNNELS_JSON="/tmp/hioshop_ngrok_tunnels.json"

# Always run ngrok without proxy env vars to avoid ERR_NGROK_9009 on free plan.
NGROK_ENV=(
  env
  -u http_proxy -u https_proxy
  -u HTTP_PROXY -u HTTPS_PROXY
  -u all_proxy -u ALL_PROXY
)

if [ -n "${http_proxy:-}" ] || [ -n "${https_proxy:-}" ] || [ -n "${HTTP_PROXY:-}" ] || [ -n "${HTTPS_PROXY:-}" ] || [ -n "${all_proxy:-}" ] || [ -n "${ALL_PROXY:-}" ]; then
  echo "[INFO] 检测到当前 shell 启用了代理，脚本将自动以无代理模式启动 ngrok。"
fi

if ! command -v ngrok >/dev/null 2>&1; then
  echo "[ERROR] ngrok 未安装，请先安装：brew install ngrok/ngrok/ngrok"
  exit 1
fi

if ! "${NGROK_ENV[@]}" ngrok config check >/dev/null 2>&1; then
  echo "[ERROR] ngrok 未配置 authtoken，请先执行："
  echo "        ngrok config add-authtoken <YOUR_TOKEN>"
  exit 1
fi

# 启动前探测本地后端端口，便于联调排错
PORT_READY=0
if command -v nc >/dev/null 2>&1; then
  if nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1; then
    PORT_READY=1
  fi
else
  if curl -sS -m 2 "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    PORT_READY=1
  fi
fi

if [ "$PORT_READY" -ne 1 ]; then
  echo "[WARN] 本地端口 $PORT 当前未响应，公网地址可创建但小程序请求会失败。"
  echo "       请先确认后端服务已启动并监听 127.0.0.1:${PORT}。"
fi

# 清理旧会话
pkill -f "ngrok http $PORT" >/dev/null 2>&1 || true

# 启动 ngrok
nohup "${NGROK_ENV[@]}" ngrok http "$PORT" >"$NGROK_LOG" 2>&1 &
NGROK_PID=$!

PUBLIC_URL=""
for i in $(seq 1 30); do
  echo "[INFO] 等待 ngrok 隧道建立 ($i/30)..."
  sleep 1
  if curl -fsS http://127.0.0.1:4040/api/tunnels >"$TUNNELS_JSON" 2>/dev/null; then
    PUBLIC_URL=$(python3 - <<'PY'
import json
p='/tmp/hioshop_ngrok_tunnels.json'
with open(p,'r',encoding='utf-8') as f:
    data=json.load(f)
url=''
for t in data.get('tunnels',[]):
    u=t.get('public_url','')
    if u.startswith('https://'):
        url=u
        break
print(url)
PY
)
    if [ -n "$PUBLIC_URL" ]; then
      break
    fi
  fi
done

if [ -z "$PUBLIC_URL" ]; then
  echo "[ERROR] 未获取到 ngrok HTTPS 地址，查看日志：$NGROK_LOG"
  echo "[ERROR] 最近 ngrok 日志："
  tail -n 40 "$NGROK_LOG" || true
  echo "[INFO] 已启动进程 PID=$NGROK_PID"
  exit 1
fi

# 改写 api.js 中 ApiRoot
python3 - "$API_FILE" "$PUBLIC_URL" <<'PY'
import re,sys
file_path,new_root=sys.argv[1],sys.argv[2]
with open(file_path,'r',encoding='utf-8') as f:
    s=f.read()
ns,repl = re.subn(r"const ApiRoot = '.*?';", f"const ApiRoot = '{new_root}';", s, count=1)
if repl != 1:
    raise SystemExit('[ERROR] 未找到 ApiRoot 定义，无法自动改写')
with open(file_path,'w',encoding='utf-8') as f:
    f.write(ns)
PY

DOMAIN=${PUBLIC_URL#https://}

cat <<EOF
[DONE] ngrok 已启动: $PUBLIC_URL
[DONE] 已改写: $API_FILE

下一步你必须手工在微信小程序后台配置：
1) request 合法域名: https://$DOMAIN
2) uploadFile 合法域名: https://$DOMAIN
3) downloadFile 合法域名: https://$DOMAIN

然后在微信开发者工具里：
- 清缓存并重新编译
- 上传体验版并真机测试

可选命令：
- 查看 ngrok 日志: tail -f $NGROK_LOG
- 停止 ngrok: pkill -f "ngrok http $PORT"
EOF
