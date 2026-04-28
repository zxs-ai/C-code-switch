const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { execFileSync, spawn } = require('child_process');
const PORT  = 7823;

// ── 在终端中执行 source ~/.zshrc ──────────────────────────
function runSourceInTerminal() {
  // 写临时 AppleScript 文件以避免 -e 链式调用的转义问题
  const script = `
tell application "System Events"
  set termRunning to (exists (processes whose name is "Terminal"))
end tell

if termRunning then
  tell application "Terminal"
    if (count of windows) > 0 then
      do script "source ~/.zshrc && echo '✅ 配置已生效！'" in front window
    else
      do script "source ~/.zshrc && echo '✅ 配置已生效！'"
    end if
  end tell
end if
`;
  const tmpFile = path.join(os.tmpdir(), 'switcher_source.scpt');
  fs.writeFileSync(tmpFile, script, 'utf8');
  try {
    execFileSync('osascript', [tmpFile], { timeout: 5000 });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}
const ZSHRC = path.join(os.homedir(), '.zshrc');

// ── Claude settings.json 路径 (VSCode Claude Code 扩展读取) ──
const CLAUDE_SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');

// ── Codex config.toml 路径 (Codex CLI 读取) ──
const CODEX_CONFIG = path.join(os.homedir(), '.codex', 'config.toml');

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

// ── 写入 ~/.claude/settings.json 的 env 字段 ─────────────
// 按照 VSCode Claude Code 扩展要求的格式，合并写入 env 字段
// 保留 settings.json 中已有的其他字段（permissions, hooks, model 等）
function applyToClaudeSettings(key, proxy) {
  let settings = {};

  // 读取现有的 settings.json，保留所有已有字段
  if (fs.existsSync(CLAUDE_SETTINGS)) {
    try {
      settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS, 'utf8'));
    } catch (e) {
      console.warn('⚠ 解析 settings.json 失败，将创建新文件:', e.message);
      settings = {};
    }
  }

  // 按 222.md 中的标准格式写入 env 字段
  settings.env = {
    "ANTHROPIC_BASE_URL": proxy,
    "ANTHROPIC_AUTH_TOKEN": key,
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_CODE_DISABLE_TERMINAL_TITLE": "1"
  };

  // 确保 .claude 目录存在
  const claudeDir = path.dirname(CLAUDE_SETTINGS);
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  console.log('✅ 已写入 ~/.claude/settings.json env 字段');
}

// ── 写入 ~/.codex/config.toml ─────────────────────────────
// 按照 33333.md 中的标准格式写入 Codex 配置
// 保留 config.toml 中已有的 [features] 和 [projects.*] 段
function applyToCodexConfig(name, key, proxy) {
  let existingContent = '';
  if (fs.existsSync(CODEX_CONFIG)) {
    try {
      existingContent = fs.readFileSync(CODEX_CONFIG, 'utf8');
    } catch (e) {
      console.warn('⚠ 读取 config.toml 失败:', e.message);
    }
  }

  // 提取需要保留的段落：[features] 和 [projects.*]
  const preservedSections = [];
  // 匹配 [features] 段
  const featuresMatch = existingContent.match(/\[features\][\s\S]*?(?=\n\[|$)/);
  if (featuresMatch) preservedSections.push(featuresMatch[0].trimEnd());
  // 匹配所有 [projects.*] 段
  const projectsRe = /\[projects\."[^"]+"\][\s\S]*?(?=\n\[|$)/g;
  let m;
  while ((m = projectsRe.exec(existingContent)) !== null) {
    preservedSections.push(m[0].trimEnd());
  }

  // 将配置名称转为合法的 provider 名称（小写、去空格）
  const providerName = name.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'custom';

  // 按 33333.md 模板格式构建新的配置
  let newContent = [
    `model_provider = "${providerName}"`,
    `model = "gpt-5.1-codex"`,
    `model_reasoning_effort = "high"`,
    `network_access = "enabled"`,
    `disable_response_storage = true`,
    `windows_wsl_setup_acknowledged = true`,
    `model_verbosity = "high"`,
    '',
    `[model_providers.${providerName}]`,
    `name = "${providerName}"`,
    `base_url = "${proxy}"`,
    `wire_api = "responses"`,
    `requires_openai_auth = true`,
    `env_key = "${key}"`,
  ].join('\n');

  // 追加保留的段落
  if (preservedSections.length > 0) {
    newContent += '\n\n' + preservedSections.join('\n\n');
  }

  newContent += '\n';

  // 确保 .codex 目录存在
  const codexDir = path.dirname(CODEX_CONFIG);
  if (!fs.existsSync(codexDir)) {
    fs.mkdirSync(codexDir, { recursive: true });
  }

  fs.writeFileSync(CODEX_CONFIG, newContent, 'utf8');
  console.log('✅ 已写入 ~/.codex/config.toml');
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

  // GET /read-claude-settings — 读取 ~/.claude/settings.json
  if (req.method === 'GET' && req.url === '/read-claude-settings') {
    try {
      const content = fs.existsSync(CLAUDE_SETTINGS)
        ? fs.readFileSync(CLAUDE_SETTINGS, 'utf8')
        : '(文件不存在)';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, content }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, msg: e.message }));
    }
    return;
  }

  // GET /read-codex-config — 读取 ~/.codex/config.toml
  if (req.method === 'GET' && req.url === '/read-codex-config') {
    try {
      const content = fs.existsSync(CODEX_CONFIG)
        ? fs.readFileSync(CODEX_CONFIG, 'utf8')
        : '(文件不存在)';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, content }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, msg: e.message }));
    }
    return;
  }

  // POST /apply  body: { type, key, proxy, name }
  if (req.method === 'POST' && req.url === '/apply') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { type, key, proxy, name } = JSON.parse(body);
        if (!type || !BLOCKS[type]) throw new Error('请指定类型 (claude/codex)');
        if (!key)   throw new Error('API Key / Token 不能为空');
        if (!proxy) throw new Error('代理地址不能为空');

        applyToZshrc(type, key, proxy);

        // Claude 类型同时写入 ~/.claude/settings.json
        if (type === 'claude') {
          applyToClaudeSettings(key, proxy);
        }
        // Codex 类型同时写入 ~/.codex/config.toml
        if (type === 'codex') {
          applyToCodexConfig(name || 'custom', key, proxy);
        }

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
      runSourceInTerminal();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, msg: e.message }));
    }
    return;
  }

  // POST /apply-and-source  body: { type, key, proxy, name }
  if (req.method === 'POST' && req.url === '/apply-and-source') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { type, key, proxy, name } = JSON.parse(body);
        if (!type || !BLOCKS[type]) throw new Error('请指定类型 (claude/codex)');
        if (!key)   throw new Error('API Key / Token 不能为空');
        if (!proxy) throw new Error('代理地址不能为空');

        // 1) 写入 ~/.zshrc（终端生效）
        applyToZshrc(type, key, proxy);

        // 2) 写入对应的配置文件
        let settingsOk = true;
        let settingsMsg = '';
        try {
          if (type === 'claude') {
            // Claude → ~/.claude/settings.json（VSCode 生效）
            applyToClaudeSettings(key, proxy);
          } else if (type === 'codex') {
            // Codex → ~/.codex/config.toml（Codex CLI 生效）
            applyToCodexConfig(name || 'custom', key, proxy);
          }
        } catch (e) {
          settingsOk = false;
          settingsMsg = e.message;
        }

        // 3) 尝试 source，失败不影响写入结果
        let sourceOk = true;
        let sourceMsg = '';
        try {
          runSourceInTerminal();
        } catch (e) {
          sourceOk = false;
          sourceMsg = e.message;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, sourceOk, sourceMsg, settingsOk, settingsMsg }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, msg: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`✅ 运行中 → 浏览器打开 http://localhost:${PORT}`);
  console.log(`   写入文件: ${ZSHRC}`);
  console.log(`   写入文件: ${CLAUDE_SETTINGS}`);
  console.log(`   写入文件: ${CODEX_CONFIG}`);
});
