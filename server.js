const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { execFileSync, spawn } = require('child_process');
const PORT  = 7823;
const ZSHRC = path.join(os.homedir(), '.zshrc');

// ── 双平台配置块 ──────────────────────────────────────────
const BLOCKS = {
  claude: {
    start: '# Claude Code Configuration (Proxy)',
    end:   '# /Claude Code Configuration',
    build: (key, proxy) => [
      '# Claude Code Configuration (Proxy)',
      `export ANTHROPIC_BASE_URL="${escapeShellValue(proxy)}"`,
      `export ANTHROPIC_AUTH_TOKEN="${escapeShellValue(key)}"`,
      '# /Claude Code Configuration',
    ].join('\n'),
    cleanRe: /ANTHROPIC_AUTH_TOKEN|ANTHROPIC_API_KEY|ANTHROPIC_BASE_URL/,
  },
  codex: {
    start: '# Codex CLI Configuration (Proxy)',
    end:   '# /Codex CLI Configuration',
    build: (key, proxy) => [
      '# Codex CLI Configuration (Proxy)',
      `export OPENAI_API_KEY="${escapeShellValue(key)}"`,
      `export OPENAI_BASE_URL="${escapeShellValue(proxy)}"`,
      '# /Codex CLI Configuration',
    ].join('\n'),
    cleanRe: /OPENAI_API_KEY|OPENAI_BASE_URL/,
  },
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 转义 shell 双引号字符串中的特殊字符
function escapeShellValue(str) {
  return str.replace(/[\\"$`!]/g, '\\$&');
}

function applyToZshrc(type, key, proxy) {
  const block = BLOCKS[type];
  if (!block) throw new Error('未知类型: ' + type);

  let content = fs.existsSync(ZSHRC) ? fs.readFileSync(ZSHRC, 'utf8') : '';
  const newBlock = block.build(key, proxy);

  const pattern = new RegExp(
    escapeRegex(block.start) + '[\\s\\S]*?' + escapeRegex(block.end)
  );

  const replaced = content.replace(pattern, newBlock);
  if (replaced !== content) {
    content = replaced;
  } else {
    content = content
      .split('\n')
      .filter(l => !block.cleanRe.test(l))
      .join('\n')
      .trimEnd();
    content += '\n\n' + newBlock + '\n';
  }

  fs.writeFileSync(ZSHRC, content, 'utf8');
}

function openZshrc() {
  try {
    spawn('open', [ZSHRC], { detached: true, stdio: 'ignore' }).unref();
  } catch (e) {
    console.error('open failed:', e.message);
  }
}

// ── HTTP Server ──────────────────────────────────────────
const server = http.createServer((req, res) => {
  const allowedOrigins = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // GET / → serve UI
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    return;
  }

  // GET /read-zshrc
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

  // POST /apply  body: { type, key, proxy }
  if (req.method === 'POST' && req.url === '/apply') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { type, key, proxy } = JSON.parse(body);
        if (!type || !BLOCKS[type]) throw new Error('请指定类型 (claude/codex)');
        if (!key)   throw new Error('API Key / Token 不能为空');
        if (!proxy) throw new Error('代理地址不能为空');

        applyToZshrc(type, key, proxy);
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
        '    do script "source ~/.zshrc && echo \\\\"✅ 配置已生效！\\\\"" in front window',
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
