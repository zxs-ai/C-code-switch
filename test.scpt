try
  tell application "Terminal"
    do script "source ~/.zshrc && echo \"✅ Claude 配置已生效！\"" in front window
  end tell
end try
