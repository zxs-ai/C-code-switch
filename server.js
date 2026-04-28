const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { execSync, execFileSync, spawn } = require('child_process');
const PORT  = 7823;
const ZSHRC = path.join(os.homedir(), '.zshrc');

const BLOCK_START = '# Claude Code Configuration (Proxy)';
const BLOCK_END   = '# /Claude Code Configuration';

function buildBlock(token, proxyUrl) {
  return [
    BLOCK_START,
    `export ANTHROPIC_BASE_URL="${proxyUrl}"`,
    `export ANTHROPIC_AUTH_TOKEN="${token}"`,
    BLOCK_END,
  ].join('\n');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyToZshrc(token, proxyUrl) {
  let content = fs.existsSync(ZSHRC) ? fs.readFileSync(ZSHRC, 'utf8') : '';
  const newBlock = buildBlock(token, proxyUrl);

  // 关键修复：不要用同一个 RegExp 对象先 .test() 再 .replace()
  // .test() 会推进 lastIndex，导致后续 .replace() 匹配失败
  // 直接用 .replace() 的返回值判断是否命中
  const blockPattern = new RegExp(
    escapeRegex(BLOCK_START) + '[\\s\\S]*?' + escapeRegex(BLOCK_END)
  );

  if (blockPattern.test(content)) {
    // 已有标记块 → 原地替换（重新创建 RegExp 避免 lastIndex 问题）
    content = content.replace(
      new RegExp(escapeRegex(BLOCK_START) + '[\\s\\S]*?' + escapeRegex(BLOCK_END)),
      newBlock
    );
  } else {
    // 没有标记块 → 清理旧版散落变量行，追加新块
    content = content
      .split('\n')
      .filter(l => !/ANTHROPIC_AUTH_TOKEN|ANTHROPIC_API_KEY|ANTHROPIC_BASE_URL/.test(l))
      .join('\n')
      .trimEnd();
    content += '\n\n' + newBlock + '\n';
  }

  fs.writeFileSync(ZSHRC, content, 'utf8');
}

function openZshrc() {
  // macOS: 用默认文本编辑器打开 ~/.zshrc
  try {
    spawn('open', [ZSHRC], { detached: true, stdio: 'ignore' }).unref();
  } catch (e) {
    console.error('open failed:', e.message);
  }
}

// ── HTTP Server ──────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // GET / → serve UI
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    return;
  }

  // GET /read-zshrc → 返回 ~/.zshrc 内容给前端展示
  if (req.method === 'GET' && req.url === '/read-zshrc') {
    try {
      const content = fs.existsSync(ZSHRC) ? fs.readFileSync(ZSHRC, 'utf8') : '(文件不存在)';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, content }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, msg: e.message }));
    }
    return;
  }

  // POST /apply  body: { token, proxy }
  if (req.method === 'POST' && req.url === '/apply') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { token, proxy } = JSON.parse(body);
        if (!token) throw new Error('AUTH TOKEN 不能为空');
        if (!proxy) throw new Error('代理地址 (ANTHROPIC_BASE_URL) 不能为空');

        applyToZshrc(token, proxy);

        // 同步成功后打开文件让用户确认
        openZshrc();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, msg: e.message }));
      }
    });
    return;
  }

  // POST /source
  if (req.method === 'POST' && req.url === '/source') {
    try {
      const lines = [
        'try',
        '  tell application "Terminal"',
        '    do script "source ~/.zshrc && echo \\"✅ Claude 配置已生效！\\"" in front window',
        '  end tell',
        'end try'
      ];
      const args = lines.flatMap(l => ['-e', l]);
      execFileSync('osascript', args);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, msg: e.message }));
    }
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`✅ 运行中 → 浏览器打开 http://localhost:${PORT}`);
  console.log(`   写入文件: ${ZSHRC}`);
});
