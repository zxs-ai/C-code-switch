#!/bin/bash

# 切换到脚本所在目录（确保能找到 server.js 和 index.html）
cd "$(dirname "$0")"

# 检查 node 是否安装
if ! command -v node &> /dev/null; then
  osascript -e 'display alert "缺少 Node.js" message "请先安装 Node.js：\n\n前往 https://nodejs.org 下载安装后，再双击运行此文件。" as critical'
  exit 1
fi

# 检查端口是否已在运行
if lsof -ti:7823 &> /dev/null; then
  # 已经在运行，直接打开浏览器
  open http://localhost:7823
  exit 0
fi

# 启动服务（后台运行，日志写到同目录的 switcher.log）
node server.js > switcher.log 2>&1 &
SERVER_PID=$!

# 等待服务启动（最多3秒）
for i in {1..6}; do
  sleep 0.5
  if lsof -ti:7823 &> /dev/null; then
    break
  fi
done

# 检查是否成功启动
if ! lsof -ti:7823 &> /dev/null; then
  osascript -e 'display alert "启动失败" message "服务未能启动，请查看同目录下的 switcher.log 了解错误信息。"'
  exit 1
fi

# 打开浏览器
open http://localhost:7823
