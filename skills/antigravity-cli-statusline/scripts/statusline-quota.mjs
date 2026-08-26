import { promises as fs } from 'fs';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { join, basename } from 'path';
import os from 'os';

// ==========================================
// Constants & UI Styling
// ==========================================
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GRAY = "\x1b[90m";
const WHITE = "\x1b[38;2;255;255;255m";
const BLUE = "\x1b[38;2;87;202;255m";
const GREEN = "\x1b[38;2;92;219;109m";
const YELLOW = "\x1b[38;2;255;212;39m";
const RED = "\x1b[38;2;255;125;175m";

function getColorByPercentage(pct) {
  if (pct >= 75) return BLUE;
  if (pct >= 50) return GREEN;
  if (pct >= 25) return YELLOW;
  return RED;
}

function getColorByCount(n) {
  if (n === 0) return BLUE;
  if (n <= 2) return GREEN;
  if (n <= 4) return YELLOW;
  return RED;
}

function getModelColor(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('claude')) return "\x1b[38;2;221;80;19m";
  if (lower.includes('gemini')) return "\x1b[38;2;71;150;227m";
  if (lower.includes('gpt') || lower.includes('chatgpt')) return "\x1b[38;2;116;170;156m";
  return "";
}

function getVcsDirtyColor(dirty) { return dirty ? RED : GREEN; }
function getToolConfirmColor(pending) { return pending ? YELLOW : GREEN; }
function getAgentStateColor(state) {
  const s = (state || '').toLowerCase();
  if (s.includes('error') || s.includes('fail')) return RED;
  if (s.includes('busy') || s.includes('run') || s.includes('think')) return YELLOW;
  if (s.includes('idle') || s.includes('ready')) return GREEN;
  return BLUE;
}
function getSandboxColor(enabled, allowNet) {
  if (!enabled) return RED;
  return allowNet ? YELLOW : GREEN;
}

function getModeColor(mode) {
  const m = (mode || '').toLowerCase();
  if (m === 'plan') return GREEN;
  if (m === 'accept-edits') return YELLOW;
  if (m === 'default') return BLUE;
  return BLUE;
}

function stripAnsi(str) {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function isZeroWidth(code) {
  if (!code || code < 32 || (code >= 0x7f && code < 0xa0)) return true;
  if (code >= 0x0300 && code <= 0x036F) return true; // Combining diacritical marks
  if (code >= 0x1AB0 && code <= 0x1AFF) return true;
  if (code >= 0x1DC0 && code <= 0x1DFF) return true;
  if (code >= 0x20D0 && code <= 0x20FF) return true;
  if (code >= 0xFE20 && code <= 0xFE2F) return true;
  if (code >= 0xFE00 && code <= 0xFE0F) return true; // Variation selectors (VS1-VS16)
  if (code >= 0xE0100 && code <= 0xE01EF) return true;
  if (code === 0x200B || code === 0x200C || code === 0x200D || code === 0xFEFF) return true;
  if (code >= 0x1F3FB && code <= 0x1F3FF) return true; // Skin tone modifiers
  return false;
}

function getDisplayWidth(str) {
  let width = 0;
  for (const char of str) {
    const code = char.codePointAt(0);
    if (isZeroWidth(code)) continue;

    // ASCII printable
    if (code >= 0x20 && code <= 0x7E) {
      width += 1;
      continue;
    }
    // Box Drawing (│), Block Elements (█, ░), Geometric Shapes, Dingbats (✓, ✗)
    if (code >= 0x2500 && code <= 0x259F) {
      width += 1;
      continue;
    }
    if (code === 0x2713 || code === 0x2717) {
      width += 1;
      continue;
    }
    // Halfwidth Katakana / punctuation
    if (code >= 0xFF61 && code <= 0xFFDC) {
      width += 1;
      continue;
    }

    // Wide characters (CJK, Emojis, Fullwidth)
    if (
      (code >= 0x1100 && code <= 0x115F) ||
      (code >= 0x2E80 && code <= 0xA4CF) ||
      (code >= 0xAC00 && code <= 0xD7A3) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0xFE30 && code <= 0xFE6F) ||
      (code >= 0xFF00 && code <= 0xFF60) ||
      (code >= 0xFFE0 && code <= 0xFFE6) ||
      (code >= 0x20000 && code <= 0x3FFFF) ||
      (code >= 0x2300 && code <= 0x23FF) ||
      (code >= 0x2600 && code <= 0x26FF) ||
      (code >= 0x2B00 && code <= 0x2BFF) ||
      (code >= 0x1F000 && code <= 0x1FAFF)
    ) {
      width += 2;
      continue;
    }

    width += 1;
  }
  return width;
}

function renderProgressBar(pct, color, length = 6) {
  const validPct = Math.min(100, Math.max(0, isNaN(pct) ? 0 : pct));
  const filled = Math.min(length, Math.max(0, Math.round((validPct / 100) * length)));
  const empty = length - filled;
  return `${GRAY}[${RESET}${color}${'█'.repeat(filled)}${GRAY}${'░'.repeat(empty)}${RESET}${GRAY}]${RESET}`;
}

function formatTokens(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

function normalizeModelName(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function safeGetCount(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (Array.isArray(val)) return val.length;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// ==========================================
// System Information Retrieval
// ==========================================
const execAsync = promisify(exec);

async function runCmdAsync(cmd, options = {}) {
  const defaultOpts = {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 1000
  };
  try {
    const { stdout } = await execAsync(cmd, { ...defaultOpts, ...options });
    return (stdout || '').trim();
  } catch (err) {
    return '';
  }
}

async function getGitBranch(lang, projectPath) {
  try {
    const opts = {
      cwd: projectPath || process.cwd()
    };
    let branch = '';
    try {
      branch = await runCmdAsync('git branch --show-current', opts);
      if (!branch) {
        branch = await runCmdAsync('git rev-parse --abbrev-ref HEAD', opts);
      }
    } catch (e) {}

    if (!branch) {
      if (process.platform === 'win32') {
        const paths = [
          'C:\\Program Files\\Git\\cmd\\git.exe',
          'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
          'C:\\Program Files\\Git\\bin\\git.exe',
          '%USERPROFILE%\\AppData\\Local\\Programs\\Git\\cmd\\git.exe',
          '%USERPROFILE%\\scoop\\apps\\git\\current\\cmd\\git.exe'
        ].map(p => p.replace(/%USERPROFILE%/g, process.env.USERPROFILE || os.homedir()));
        for (const gitPath of paths) {
          try {
            await fs.access(gitPath);
            branch = await runCmdAsync(`"${gitPath}" branch --show-current`, opts);
            if (!branch) {
              branch = await runCmdAsync(`"${gitPath}" rev-parse --abbrev-ref HEAD`, opts);
            }
            if (branch) break;
          } catch (e) {}
        }
      } else {
        const paths = [
          '/usr/local/bin/git',
          '/opt/homebrew/bin/git',
          '/usr/bin/git'
        ];
        for (const gitPath of paths) {
          try {
            await fs.access(gitPath);
            branch = await runCmdAsync(`"${gitPath}" branch --show-current`, opts);
            if (!branch) {
              branch = await runCmdAsync(`"${gitPath}" rev-parse --abbrev-ref HEAD`, opts);
            }
            if (branch) break;
          } catch (e) {}
        }
      }
    }
    const noVcStr = (lang === 'zh-cn' ? '无版本控制' : (lang === 'zh-tw' ? '無版本控制' : (lang === 'jp' ? 'バージョン管理なし' : 'No VC')));
    return branch || noVcStr;
  } catch (e) {
    return (lang === 'zh-cn' ? '无版本控制' : (lang === 'zh-tw' ? '無版本控制' : (lang === 'jp' ? 'バージョン管理なし' : 'No VC')));
  }
}

async function getGitDirty(projectPath) {
  try {
    const opts = {
      cwd: projectPath || process.cwd()
    };
    let out = '';
    try {
      out = await runCmdAsync('git status --porcelain', opts);
    } catch (err) {}

    if (!out) {
      if (process.platform === 'win32') {
        const paths = [
          'C:\\Program Files\\Git\\cmd\\git.exe',
          'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
          'C:\\Program Files\\Git\\bin\\git.exe',
          '%USERPROFILE%\\AppData\\Local\\Programs\\Git\\cmd\\git.exe',
          '%USERPROFILE%\\scoop\\apps\\git\\current\\cmd\\git.exe'
        ].map(p => p.replace(/%USERPROFILE%/g, process.env.USERPROFILE || os.homedir()));
        for (const gitPath of paths) {
          try {
            await fs.access(gitPath);
            out = await runCmdAsync(`"${gitPath}" status --porcelain`, opts);
            if (out) break;
          } catch (e) {}
        }
      } else {
        const paths = [
          '/usr/local/bin/git',
          '/opt/homebrew/bin/git',
          '/usr/bin/git'
        ];
        for (const gitPath of paths) {
          try {
            await fs.access(gitPath);
            out = await runCmdAsync(`"${gitPath}" status --porcelain`, opts);
            if (out) break;
          } catch (e) {}
        }
      }
    }
    return out.trim().length > 0;
  } catch (e) {
    return false;
  }
}

async function getCliMemoryMB() {
  try {
    if (process.platform === 'win32') {
      try {
        const cmd = `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ProcessId = ${process.ppid}' | ForEach-Object { if ($_.Name -like '*agy*') { $_ } else { Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $_.ParentProcessId) } } | ForEach-Object { if ($_.Name -like '*agy*') { $_.WorkingSetSize } }"`;
        const output = await runCmdAsync(cmd);
        const memBytes = parseInt(output.trim(), 10);
        if (!isNaN(memBytes) && memBytes > 0) {
          return Math.round(memBytes / 1024 / 1024);
        }
      } catch (err) {}
      return Math.round(process.memoryUsage().rss / 1024 / 1024);
    } else {
      const output = await runCmdAsync(`ps -o rss= -p ${process.ppid}`);
      const memKb = parseInt(output.trim(), 10);
      if (!isNaN(memKb)) return Math.round(memKb / 1024);
    }
  } catch (e) {}
  try {
    return Math.round(process.memoryUsage().rss / 1024 / 1024);
  } catch (e) {
    return 0;
  }
}

// ==========================================
// Initialization & Config Reading
// ==========================================
async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    let timer = setTimeout(() => resolve(data), 50);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
  });
}

async function getSettingsAsync(meta) {
  const globalPath = join(os.homedir(), '.gemini', 'settings.json');
  const cliPath = join(os.homedir(), '.gemini', 'antigravity-cli', 'settings.json');
  const projectDir = (typeof meta?.project?.path === 'string' && meta.project.path)
    ? meta.project.path
    : process.cwd();
  const projectPath = join(projectDir, '.gemini', 'settings.json');
  let settings = {};

  try {
    const globalContent = await fs.readFile(globalPath, 'utf8');
    settings = JSON.parse(globalContent.replace(/^\uFEFF/, ''));
  } catch (e) {}

  try {
    const cliContent = await fs.readFile(cliPath, 'utf8');
    const cliSettings = JSON.parse(cliContent.replace(/^\uFEFF/, ''));
    settings = { ...settings, ...cliSettings };
    if (cliSettings.ui) {
      settings.ui = { ...settings.ui, ...cliSettings.ui };
      if (cliSettings.ui.footer) {
        settings.ui.footer = { ...settings.ui.footer, ...cliSettings.ui.footer };
      }
    }
  } catch (e) {}

  try {
    const projContent = await fs.readFile(projectPath, 'utf8');
    const projSettings = JSON.parse(projContent.replace(/^\uFEFF/, ''));
    settings = { ...settings, ...projSettings };
    if (projSettings.ui) {
      settings.ui = { ...settings.ui, ...projSettings.ui };
      if (projSettings.ui.footer) {
        settings.ui.footer = { ...settings.ui.footer, ...projSettings.ui.footer };
      }
    }
  } catch (e) {}

  return settings;
}

// ==========================================
// Business Logic Helpers
// ==========================================
async function triggerQuotaUpdateIfNeededAsync(cacheInfo) {
  let needUpdate = true;
  if (cacheInfo && Date.now() - (cacheInfo.updatedAt || 0) < 30000) needUpdate = false;

  if (needUpdate) {
    try {
      const updaterScript = join(os.homedir(), '.gemini', 'antigravity-cli', 'hooks', 'fetch-local-quota.mjs');
      await fs.access(updaterScript);
      const proc = spawn('node', [updaterScript], {
        env: { ...process.env, DISABLE_QUOTA_HOOK: '1' },
        stdio: 'ignore',
        detached: true,
        windowsHide: true
      });
      proc.on('error', () => {});
      proc.unref();
    } catch (e) {}
  }
}

function resolveModelQuota(fallbackModel, cache) {
  const normModel = normalizeModelName(fallbackModel);
  let modelQuota = null;
  if (cache && cache.models) {
    // 1. Exact match
    if (cache.models[normModel]) {
      modelQuota = cache.models[normModel];
    } else {
      // 2. Substring match
      for (const k in cache.models) {
        if (normModel.includes(k) || k.includes(normModel)) {
          modelQuota = cache.models[k];
          break;
        }
      }
    }
    // 3. Family match
    if (!modelQuota) {
      const families = ['claude', 'gemini', 'gpt'];
      const modelFamily = families.find(f => normModel.includes(f));
      if (modelFamily) {
        for (const k in cache.models) {
          if (k.includes(modelFamily)) {
            if (!modelQuota || cache.models[k].remaining_percentage < modelQuota.remaining_percentage) {
              modelQuota = cache.models[k];
            }
          }
        }
      }
    }
  }
  // 4. Global minimum fallback
  if (!modelQuota && cache && cache.models) {
    const allKeys = Object.keys(cache.models);
    if (allKeys.length > 0) {
      modelQuota = allKeys.reduce((min, k) =>
        cache.models[k].remaining_percentage < min.remaining_percentage ? cache.models[k] : min
      , cache.models[allKeys[0]]);
    }
  }
  return modelQuota || { remaining_percentage: 100, refreshes_in: '' };
}

/**
 * Maps a model display name to its weekly quota pool ('gemini' | '3p') and weekly quota.
 * @param {string} fallbackModel - the fallback model display name
 * @param {object} cache - the local quota cache object
 * @returns {{remaining_percentage:number,reset_time?:string,refreshes_in?:string}}
 */
function resolveWeeklyQuota(fallbackModel, cache) {
  const normModel = normalizeModelName(fallbackModel);
  let pool = '';
  if (normModel.includes('gemini')) {
    pool = 'gemini';
  } else if (normModel.includes('claude') || normModel.includes('gpt')) {
    pool = '3p';
  }

  if (pool && cache && cache.weekly && cache.weekly[pool]) {
    return cache.weekly[pool];
  }

  // A4 Fallback (lowest remaining_percentage among available weekly pools)
  if (cache && cache.weekly) {
    const pools = Object.keys(cache.weekly);
    if (pools.length > 0) {
      let minPool = pools[0];
      for (const p of pools) {
        if (cache.weekly[p].remaining_percentage < cache.weekly[minPool].remaining_percentage) {
          minPool = p;
        }
      }
      return cache.weekly[minPool];
    }
  }

  return { remaining_percentage: 100, refreshes_in: '' };
}

async function writeFileAndVerifyNoBOM(filePath, content) {
  await fs.writeFile(filePath, content, { encoding: 'utf8' });
  let buffer = await fs.readFile(filePath);
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    buffer = buffer.slice(3);
    await fs.writeFile(filePath, buffer);
  }
}

async function calculateContextUsageAsync(meta, conversationId) {
  const contextWindow = meta.context_window || {};
  const ctxCachePath = join(os.homedir(), '.gemini', 'tmp', `ctx_${conversationId}.json`);
  
  let totalInput = contextWindow.total_input_tokens || 0;
  let totalOutput = contextWindow.total_output_tokens || 0;
  let usedPctNum = contextWindow.used_percentage || 0;
  let contextSize = contextWindow.context_window_size || 0;
  
  if (totalInput === 0 && totalOutput === 0) {
    try {
      const content = await fs.readFile(ctxCachePath, 'utf8');
      const cachedCtx = JSON.parse(content.replace(/^\uFEFF/, ''));
      totalInput = cachedCtx.total_input_tokens || 0;
      totalOutput = cachedCtx.total_output_tokens || 0;
      if (cachedCtx.used_percentage) usedPctNum = cachedCtx.used_percentage;
      if (cachedCtx.context_window_size) contextSize = cachedCtx.context_window_size;
    } catch (e) {}
  } else {
    try {
      await fs.mkdir(join(os.homedir(), '.gemini', 'tmp'), { recursive: true });
      await writeFileAndVerifyNoBOM(ctxCachePath, JSON.stringify({
        total_input_tokens: totalInput,
        total_output_tokens: totalOutput,
        used_percentage: usedPctNum,
        context_window_size: contextSize
      }));
    } catch (e) {}
  }
  
  if (!contextSize) contextSize = 1048576;
  if (contextSize > 0 && totalInput > 0 && !usedPctNum) {
    usedPctNum = (totalInput / contextSize) * 100;
  }
  
  return { totalInput, contextSize, usedPctNum };
}

async function manageAccountMetaCacheAsync(meta) {
  const accountMetaPath = join(os.homedir(), '.gemini', 'tmp', 'account_meta_cache.json');
  let cachedAccount = {};
  try {
    const content = await fs.readFile(accountMetaPath, 'utf8');
    cachedAccount = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch (e) {}
  
  if (meta && meta.account && (meta.account.email || meta.account.plan_tier)) {
    if (meta.account.email) cachedAccount.email = meta.account.email;
    if (meta.account.plan_tier) cachedAccount.planTier = meta.account.plan_tier;
    try {
      await fs.mkdir(join(os.homedir(), '.gemini', 'tmp'), { recursive: true });
      await writeFileAndVerifyNoBOM(accountMetaPath, JSON.stringify(cachedAccount));
    } catch (e) {}
  }
  return cachedAccount;
}

async function getMetricValueAsync(meta, keys, countersCachePath, fallbackFn) {
  if (meta) {
    for (const key of keys) {
      if (meta[key] !== undefined && meta[key] !== null) {
        return safeGetCount(meta[key]);
      }
    }
  }

  let cacheCounters = null;
  if (countersCachePath) {
    try {
      const content = await fs.readFile(countersCachePath, 'utf8');
      cacheCounters = JSON.parse(content.replace(/^\uFEFF/, ''));
    } catch (e) {}
  }

  if (cacheCounters) {
    for (const key of keys) {
      if (cacheCounters[key] !== undefined && cacheCounters[key] !== null) {
        return safeGetCount(cacheCounters[key]);
      }
    }
  }

  return await fallbackFn();
}

function getAgentStateLabel(lang, rawState) {
  const s = (rawState || '').toLowerCase();
  if (lang === 'zh-cn') {
    if (s.includes('error') || s.includes('fail')) return '异常';
    if (s.includes('think')) return '思考中';
    if (s.includes('tool')) return '工具调用中';
    if (s.includes('work') || s.includes('busy') || s.includes('run')) return '工作中';
    if (s.includes('init')) return '初始化中';
    if (s.includes('idle') || s.includes('ready')) return '空闲';
    return rawState || '空闲';
  }
  if (lang === 'zh-tw') {
    if (s.includes('error') || s.includes('fail')) return '異常';
    if (s.includes('think')) return '思考中';
    if (s.includes('tool')) return '工具呼叫中';
    if (s.includes('work') || s.includes('busy') || s.includes('run')) return '工作中';
    if (s.includes('init')) return '初始化中';
    if (s.includes('idle') || s.includes('ready')) return '閒置';
    return rawState || '閒置';
  }
  if (lang === 'jp') {
    if (s.includes('error') || s.includes('fail')) return 'エラー';
    if (s.includes('think')) return '思考中';
    if (s.includes('tool')) return 'ツール呼出中';
    if (s.includes('work') || s.includes('busy') || s.includes('run')) return '実行中';
    if (s.includes('init')) return '初期化中';
    if (s.includes('idle') || s.includes('ready')) return '待機中';
    return rawState || '待機中';
  }
  if (s.includes('error') || s.includes('fail')) return 'error';
  if (s.includes('think')) return 'thinking';
  if (s.includes('tool')) return 'tool use';
  if (s.includes('work') || s.includes('busy') || s.includes('run')) return 'working';
  if (s.includes('init')) return 'initializing';
  if (s.includes('idle') || s.includes('ready')) return 'idle';
  return rawState || 'idle';
}

async function extractMetricsAsync(meta, lang, fallbackModel, cache, cachedAccount, quotaInfo, contextInfo, weeklyInfo = { remaining_percentage: 100, refreshes_in: '' }) {
  const unknownStr = (lang === 'zh-cn' || lang === 'zh-tw') ? '未知' : (lang === 'jp' ? '不明' : 'Unknown');

  // Quota
  const quotaPct = quotaInfo.remaining_percentage;
  const quotaColor = getColorByPercentage(quotaPct);
  const quotaVal = `${Math.round(quotaPct)}%`;
  const quotaBar = renderProgressBar(quotaPct, quotaColor, 6);
  const countdownVal = quotaInfo.refreshes_in || '';

  // Weekly Quota
  const weeklyPct = weeklyInfo.remaining_percentage;
  const weeklyQuotaColor = getColorByPercentage(weeklyPct);
  const weeklyQuotaVal = `${Math.round(weeklyPct)}%`;
  const weeklyQuotaBar = renderProgressBar(weeklyPct, weeklyQuotaColor, 6);
  const weeklyCountdownVal = weeklyInfo.refreshes_in || '';

  // Context
  const remainCtx = Math.max(0, 100 - contextInfo.usedPctNum);
  const contextColor = getColorByPercentage(remainCtx);
  const usedPct = `${contextInfo.usedPctNum.toFixed(1)}%`;
  const contextBar = renderProgressBar(contextInfo.usedPctNum, contextColor, 6);
  const tokenCount = `${contextColor}${formatTokens(contextInfo.totalInput)}${RESET} / ${formatTokens(contextInfo.contextSize)}`;

  const projectPath = (typeof meta?.project?.path === 'string' && meta.project.path) ? meta.project.path : process.cwd();
  const projectName = basename(projectPath);
  const projectFullPath = projectPath;

  // Account
  const planTier = (cache && cache.planTier) ? cache.planTier : (meta?.account?.plan_tier || cachedAccount.planTier || unknownStr);
  const accountEmail = (cache && cache.email) ? cache.email : (meta?.account?.email || cachedAccount.email || unknownStr);

  // Agent State
  const agentState = meta?.agent_state || 'idle';
  const agentStateLabel = getAgentStateLabel(lang, agentState);
  const toolConfirmPending = !!meta?.tool_confirmation_pending;

  // Filter out inactive subagents before counting
  if (Array.isArray(meta?.subagents)) {
    meta.subagents = meta.subagents.filter(s => {
      if (typeof s === 'object' && s.status) {
        return s.status !== 'completed' && s.status !== 'stopped' && s.status !== 'error';
      }
      return true; // Keep if format is unknown
    });
  }

  const countersCachePath = join(os.homedir(), '.gemini', 'tmp', 'statusline_counters.json');

  // 併行執行非同步操作
  const [
    gitBranch,
    vcsDirtyFlag,
    rssMem,
    pendingInputCount,
    backgroundTasksCount,
    subagentsCount,
    artifactsCount
  ] = await Promise.all([
    // 1. Git 分支
    (typeof meta?.vcs?.branch === 'string' && meta.vcs.branch)
      ? Promise.resolve(meta.vcs.branch)
      : getGitBranch(lang, projectPath),

    // 2. Git Dirty
    (typeof meta?.vcs?.dirty === 'boolean')
      ? Promise.resolve(meta.vcs.dirty)
      : getGitDirty(projectPath),

    // 3. Memory
    getCliMemoryMB(),

    // 4. Pending Input
    getMetricValueAsync(
      meta,
      ['pending_input_count', 'pending_input', 'pending_inputs'],
      countersCachePath,
      async () => {
        const pendingInputFilePath = join(os.homedir(), '.gemini', 'tmp', 'pending_input_count');
        try {
          const fileContent = (await fs.readFile(pendingInputFilePath, 'utf8')).trim();
          const parsed = Number(fileContent);
          return isNaN(parsed) ? 0 : parsed;
        } catch (e) {
          if (process.env.PENDING_INPUT_COUNT !== undefined) {
            const parsed = Number(process.env.PENDING_INPUT_COUNT);
            return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
        }
      }
    ),

    // 5. Background Tasks
    getMetricValueAsync(
      meta,
      ['background_tasks', 'background_tasks_count', 'background_jobs'],
      countersCachePath,
      async () => {
        const bgTasksDir = join(os.homedir(), '.gemini', 'tmp', 'background-processes');
        try {
          const files = await fs.readdir(bgTasksDir);
          const stats = await Promise.all(
            files.map(async (file) => {
              if (file.startsWith('.')) return false;
              try {
                const stat = await fs.stat(join(bgTasksDir, file));
                return stat.isFile();
              } catch (e) {
                return false;
              }
            })
          );
          return stats.filter(Boolean).length;
        } catch (e) {
          return 0;
        }
      }
    ),

    // 6. Subagents
    getMetricValueAsync(
      meta,
      ['subagents', 'subagents_count', 'active_subagents'],
      countersCachePath,
      async () => {
        const agentsDir = join(projectPath, '.agents');
        try {
          const dirs = await fs.readdir(agentsDir);
          const now = Date.now();
          const results = await Promise.all(
            dirs.map(async (d) => {
              if (d.startsWith('.')) return 0;
              const dPath = join(agentsDir, d);
              try {
                const statD = await fs.stat(dPath);
                if (statD.isDirectory()) {
                  const progressPath = join(dPath, 'progress.md');
                  const statP = await fs.stat(progressPath);
                  if (now - statP.mtimeMs <= 300000) {
                    return 1;
                  }
                }
              } catch (e) {}
              return 0;
            })
          );
          return results.reduce((sum, val) => sum + val, 0);
        } catch (e) {
          return 0;
        }
      }
    ),

    // 7. Artifacts
    getMetricValueAsync(
      meta,
      ['artifacts', 'artifacts_count', 'artifact_count'],
      countersCachePath,
      async () => {
        const rawConvId = (typeof meta?.conversation_id === 'string' && meta.conversation_id)
          ? meta.conversation_id.replace(/\.\./g, '').replace(/\//g, '').replace(/\\/g, '')
          : '';
        if (rawConvId) {
          const brainDir = join(os.homedir(), '.gemini', 'antigravity-cli', 'brain', rawConvId);
          try {
            const files = await fs.readdir(brainDir);
            const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));
            return metadataFiles.length;
          } catch (e) {
            return 0;
          }
        } else {
          return 0;
        }
      }
    )
  ]);

  const memUsage = `${rssMem}MB`;
  const vcsDirtyGlyph = vcsDirtyFlag ? '✗' : '✓';
  const vcsDirtyLabel = vcsDirtyFlag
    ? (lang === 'zh-cn' ? '工作区有变更' : (lang === 'zh-tw' ? '工作區有變更' : (lang === 'jp' ? '変更あり' : 'dirty')))
    : (lang === 'zh-cn' ? '工作区干净' : (lang === 'zh-tw' ? '工作區乾淨' : (lang === 'jp' ? 'クリーン' : 'clean')));
  const vcsType = meta?.vcs?.type || 'git';

  const sandboxEnabled = !!meta?.sandbox?.enabled;
  const sandboxAllowNet = !!meta?.sandbox?.allow_network;
  let sandboxStatusVal;
  if (!sandboxEnabled) {
    sandboxStatusVal = (lang === 'zh-cn') ? '沙盒关闭' : ((lang === 'zh-tw') ? '沙盒關閉' : ((lang === 'jp') ? 'サンドボックス無効' : 'sandbox off'));
  } else if (sandboxAllowNet) {
    sandboxStatusVal = (lang === 'zh-cn') ? '沙盒开启 (联网)' : ((lang === 'zh-tw') ? '沙盒啟用 (聯網)' : ((lang === 'jp') ? 'サンドボックス有効 (ネット)' : 'sandbox on (net)'));
  } else {
    sandboxStatusVal = (lang === 'zh-cn') ? '沙盒开启 (离线)' : ((lang === 'zh-tw') ? '沙盒啟用 (離線)' : ((lang === 'jp') ? 'サンドボックス有効 (オフライン)' : 'sandbox on (offline)'));
  }

  let agentProfileName = (lang === 'zh-cn' || lang === 'zh-tw') ? (lang === 'zh-cn' ? '默认' : '預設') : (lang === 'jp' ? 'デフォルト' : 'Default');
  if (typeof meta?.agent === 'string') agentProfileName = meta.agent;
  else if (meta?.agent?.display_name) agentProfileName = meta.agent.display_name;
  else if (meta?.agent?.name) agentProfileName = meta.agent.name;
  else if (meta?.agent?.id) agentProfileName = meta.agent.id;
  else if (meta?.agent?.profile) agentProfileName = meta.agent.profile;

  const cliVersion = meta?.version ? `v${meta.version}` : unknownStr;
  const rawConvId = typeof meta?.conversation_id === 'string' ? meta.conversation_id : '';
  const conversationIdShort = rawConvId ? rawConvId.replace(/-/g, '').slice(0, 8) : unknownStr;
  let modeVal = (typeof meta?.cycle_mode === 'string' && meta.cycle_mode.trim())
    ? meta.cycle_mode.trim()
    : ((typeof meta?.mode === 'string' && meta.mode.trim()) ? meta.mode.trim() : 'default');
  if (modeVal.length > 0) {
    modeVal = modeVal.charAt(0).toUpperCase() + modeVal.slice(1);
  }
  const mode = modeVal;

  return {
    fallbackModel, quotaColor, quotaVal, quotaBar, contextColor, usedPct, contextBar, memUsage, tokenCount,
    countdownVal, gitBranch, projectName, projectFullPath, planTier, accountEmail,
    agentState, agentStateLabel, toolConfirmPending, pendingInputCount, backgroundTasksCount, subagentsCount,
    artifactsCount, vcsDirtyFlag, vcsDirtyGlyph, vcsDirtyLabel, vcsType, sandboxEnabled,
    sandboxAllowNet, sandboxStatusVal, cliVersion, conversationIdShort, agentProfileName,
    weeklyQuotaColor, weeklyQuotaVal, weeklyQuotaBar, weeklyCountdownVal, mode
  };
}

function buildI18nDict(lang, m) {
  const dicts = {
    'zh-cn': {
      'model-name': `🤖 ${getModelColor(m.fallbackModel)}${BOLD}${m.fallbackModel}${RESET}`,
      'quota': `⚡ ${m.quotaBar} ${m.quotaColor}${BOLD}${m.quotaVal}${RESET}`,
      'quota-reset-countdown': m.countdownVal
        ? `⚡ ${m.quotaBar} ${m.quotaColor}${BOLD}${m.quotaVal}${RESET}（⏳${m.countdownVal}）`
        : `⚡ ${m.quotaBar} ${m.quotaColor}${BOLD}${m.quotaVal}${RESET}`,
      'quota-weekly': `📅 ${m.weeklyQuotaBar} ${m.weeklyQuotaColor}${BOLD}${m.weeklyQuotaVal}${RESET}`,
      'quota-weekly-countdown': m.weeklyCountdownVal
        ? `📅 ${m.weeklyQuotaBar} ${m.weeklyQuotaColor}${BOLD}${m.weeklyQuotaVal}${RESET}（⏳${m.weeklyCountdownVal}）`
        : `📅 ${m.weeklyQuotaBar} ${m.weeklyQuotaColor}${BOLD}${m.weeklyQuotaVal}${RESET}`,
      'context-used': `📚 ${m.contextBar} ${m.contextColor}${BOLD}${m.usedPct}${RESET}`,
      'token-count': `🪙 ${m.tokenCount}`,
      'memory-usage': `💻 ${BLUE}${BOLD}${m.memUsage}${RESET}`,
      'git-branch': `🌿 ${BOLD}${m.gitBranch}${RESET}`,
      'vcs-dirty': `📝 ${getVcsDirtyColor(m.vcsDirtyFlag)}${BOLD}${m.vcsDirtyGlyph} ${m.vcsDirtyLabel}${RESET}`,
      'vcs-type': `🗂️ ${BOLD}${m.vcsType}${RESET}`,
      'project-path': `📁 ${BOLD}${m.projectName}${RESET}`,
      'project-full-path': `📁 ${BOLD}${m.projectFullPath}${RESET}`,
      'plan-tier': `👑 ${BOLD}${m.planTier}${RESET}`,
      'account-email': `👤 ${BOLD}${m.accountEmail}${RESET}`,
      'agent-profile': `🎭 ${BLUE}${BOLD}${m.agentProfileName} 角色${RESET}`,
      'agent-state': `⚙️ ${getAgentStateColor(m.agentState)}${BOLD}${m.agentStateLabel}${RESET}`,
      'tool-confirmation': `🔔 ${getToolConfirmColor(m.toolConfirmPending)}${BOLD}${m.toolConfirmPending ? '等待确认' : '已就绪'}${RESET}`,
      'pending-input': `📥 ${getColorByCount(m.pendingInputCount)}${BOLD}${m.pendingInputCount}${RESET} 队列`,
      'background-tasks': `🔄 ${getColorByCount(m.backgroundTasksCount)}${BOLD}${m.backgroundTasksCount}${RESET} 后台`,
      'subagents': `👥 ${getColorByCount(m.subagentsCount)}${BOLD}${m.subagentsCount}${RESET} 子代理`,
      'artifacts': `📦 ${BOLD}${m.artifactsCount}${RESET} 工件`,
      'sandbox-status': `🛡️ ${getSandboxColor(m.sandboxEnabled, m.sandboxAllowNet)}${BOLD}${m.sandboxStatusVal}${RESET}`,
      'cli-version': `🏷️ ${BOLD}${m.cliVersion}${RESET}`,
      'conversation-id': `💬 ${BOLD}${m.conversationIdShort}${RESET}`,
      'mode': `🎯 ${getModeColor(m.mode)}${BOLD}${m.mode} 模式${RESET}`
    },
    'zh-tw': {
      'model-name': `🤖 ${getModelColor(m.fallbackModel)}${BOLD}${m.fallbackModel}${RESET}`,
      'quota': `⚡ ${m.quotaBar} ${m.quotaColor}${BOLD}${m.quotaVal}${RESET}`,
      'quota-reset-countdown': m.countdownVal
        ? `⚡ ${m.quotaBar} ${m.quotaColor}${BOLD}${m.quotaVal}${RESET}（⏳${m.countdownVal}）`
        : `⚡ ${m.quotaBar} ${m.quotaColor}${BOLD}${m.quotaVal}${RESET}`,
      'quota-weekly': `📅 ${m.weeklyQuotaBar} ${m.weeklyQuotaColor}${BOLD}${m.weeklyQuotaVal}${RESET}`,
      'quota-weekly-countdown': m.weeklyCountdownVal
        ? `📅 ${m.weeklyQuotaBar} ${m.weeklyQuotaColor}${BOLD}${m.weeklyQuotaVal}${RESET}（⏳${m.weeklyCountdownVal}）`
        : `📅 ${m.weeklyQuotaBar} ${m.weeklyQuotaColor}${BOLD}${m.weeklyQuotaVal}${RESET}`,
      'context-used': `📚 ${m.contextBar} ${m.contextColor}${BOLD}${m.usedPct}${RESET}`,
      'token-count': `🪙 ${m.tokenCount}`,
      'memory-usage': `💻 ${BLUE}${BOLD}${m.memUsage}${RESET}`,
      'git-branch': `🌿 ${BOLD}${m.gitBranch}${RESET}`,
      'vcs-dirty': `📝 ${getVcsDirtyColor(m.vcsDirtyFlag)}${BOLD}${m.vcsDirtyGlyph} ${m.vcsDirtyLabel}${RESET}`,
      'vcs-type': `🗂️ ${BOLD}${m.vcsType}${RESET}`,
      'project-path': `📁 ${BOLD}${m.projectName}${RESET}`,
      'project-full-path': `📁 ${BOLD}${m.projectFullPath}${RESET}`,
      'plan-tier': `👑 ${BOLD}${m.planTier}${RESET}`,
      'account-email': `👤 ${BOLD}${m.accountEmail}${RESET}`,
      'agent-profile': `🎭 ${BLUE}${BOLD}${m.agentProfileName} 角色${RESET}`,
      'agent-state': `⚙️ ${getAgentStateColor(m.agentState)}${BOLD}${m.agentStateLabel}${RESET}`,
      'tool-confirmation': `🔔 ${getToolConfirmColor(m.toolConfirmPending)}${BOLD}${m.toolConfirmPending ? '在等你' : '都好了'}${RESET}`,
      'pending-input': `📥 ${getColorByCount(m.pendingInputCount)}${BOLD}${m.pendingInputCount}${RESET} 待處理輸入`,
      'background-tasks': `🔄 ${getColorByCount(m.backgroundTasksCount)}${BOLD}${m.backgroundTasksCount}${RESET} 背景任務`,
      'subagents': `👥 ${getColorByCount(m.subagentsCount)}${BOLD}${m.subagentsCount}${RESET} 子代理`,
      'artifacts': `📦 ${BOLD}${m.artifactsCount}${RESET} 工件數`,
      'sandbox-status': `🛡️ ${getSandboxColor(m.sandboxEnabled, m.sandboxAllowNet)}${BOLD}${m.sandboxStatusVal}${RESET}`,
      'cli-version': `🏷️ ${BOLD}${m.cliVersion}${RESET}`,
      'conversation-id': `💬 ${BOLD}${m.conversationIdShort}${RESET}`,
      'mode': `🎯 ${getModeColor(m.mode)}${BOLD}${m.mode} 模式${RESET}`
    },
    'us': {
      'model-name': `🤖 ${getModelColor(m.fallbackModel)}${BOLD}${m.fallbackModel}${RESET}`,
      'quota': `⚡ ${m.quotaBar} ${m.quotaColor}${BOLD}${m.quotaVal}${RESET}`,
      'quota-reset-countdown': m.countdownVal
        ? `⚡ ${m.quotaBar} ${m.quotaColor}${BOLD}${m.quotaVal}${RESET} (⏳${m.countdownVal})`
        : `⚡ ${m.quotaBar} ${m.quotaColor}${BOLD}${m.quotaVal}${RESET}`,
      'quota-weekly': `📅 ${m.weeklyQuotaBar} ${m.weeklyQuotaColor}${BOLD}${m.weeklyQuotaVal}${RESET}`,
      'quota-weekly-countdown': m.weeklyCountdownVal
        ? `📅 ${m.weeklyQuotaBar} ${m.weeklyQuotaColor}${BOLD}${m.weeklyQuotaVal}${RESET} (⏳${m.weeklyCountdownVal})`
        : `📅 ${m.weeklyQuotaBar} ${m.weeklyQuotaColor}${BOLD}${m.weeklyQuotaVal}${RESET}`,
      'context-used': `📚 ${m.contextBar} ${m.contextColor}${BOLD}${m.usedPct}${RESET}`,
      'token-count': `🪙 ${m.tokenCount}`,
      'memory-usage': `💻 ${BLUE}${BOLD}${m.memUsage}${RESET}`,
      'git-branch': `🌿 ${BOLD}${m.gitBranch}${RESET}`,
      'vcs-dirty': `📝 ${getVcsDirtyColor(m.vcsDirtyFlag)}${BOLD}${m.vcsDirtyGlyph} ${m.vcsDirtyLabel}${RESET}`,
      'vcs-type': `🗂️ ${BOLD}${m.vcsType}${RESET}`,
      'project-path': `📁 ${BOLD}${m.projectName}${RESET}`,
      'project-full-path': `📁 ${BOLD}${m.projectFullPath}${RESET}`,
      'plan-tier': `👑 ${BOLD}${m.planTier}${RESET}`,
      'account-email': `👤 ${BOLD}${m.accountEmail}${RESET}`,
      'agent-profile': `🎭 ${BLUE}${BOLD}${m.agentProfileName}${RESET}`,
      'agent-state': `⚙️ ${getAgentStateColor(m.agentState)}${BOLD}${m.agentStateLabel}${RESET}`,
      'tool-confirmation': `🔔 ${getToolConfirmColor(m.toolConfirmPending)}${BOLD}${m.toolConfirmPending ? 'waiting' : 'ready'}${RESET}`,
      'pending-input': `📥 ${getColorByCount(m.pendingInputCount)}${BOLD}${m.pendingInputCount}${RESET} queued`,
      'background-tasks': `🔄 ${getColorByCount(m.backgroundTasksCount)}${BOLD}${m.backgroundTasksCount}${RESET} bg tasks`,
      'subagents': `👥 ${getColorByCount(m.subagentsCount)}${BOLD}${m.subagentsCount}${RESET} subagents`,
      'artifacts': `📦 ${BOLD}${m.artifactsCount}${RESET} artifacts`,
      'sandbox-status': `🛡️ ${getSandboxColor(m.sandboxEnabled, m.sandboxAllowNet)}${BOLD}${m.sandboxStatusVal}${RESET}`,
      'cli-version': `🏷️ ${BOLD}${m.cliVersion}${RESET}`,
      'conversation-id': `💬 ${BOLD}${m.conversationIdShort}${RESET}`,
      'mode': `🎯 ${getModeColor(m.mode)}${BOLD}${m.mode} Mode${RESET}`
    },
    'jp': {
      'model-name': `🤖 ${getModelColor(m.fallbackModel)}${BOLD}${m.fallbackModel}${RESET}`,
      'quota': `⚡ ${m.quotaBar} ${m.quotaColor}${BOLD}${m.quotaVal}${RESET}`,
      'quota-reset-countdown': m.countdownVal
        ? `⚡ ${m.quotaBar} ${m.quotaColor}${BOLD}${m.quotaVal}${RESET}（⏳${m.countdownVal}）`
        : `⚡ ${m.quotaBar} ${m.quotaColor}${BOLD}${m.quotaVal}${RESET}`,
      'quota-weekly': `📅 ${m.weeklyQuotaBar} ${m.weeklyQuotaColor}${BOLD}${m.weeklyQuotaVal}${RESET}`,
      'quota-weekly-countdown': m.weeklyCountdownVal
        ? `📅 ${m.weeklyQuotaBar} ${m.weeklyQuotaColor}${BOLD}${m.weeklyQuotaVal}${RESET}（⏳${m.weeklyCountdownVal}）`
        : `📅 ${m.weeklyQuotaBar} ${m.weeklyQuotaColor}${BOLD}${m.weeklyQuotaVal}${RESET}`,
      'context-used': `📚 ${m.contextBar} ${m.contextColor}${BOLD}${m.usedPct}${RESET}`,
      'token-count': `🪙 ${m.tokenCount}`,
      'memory-usage': `💻 ${BLUE}${BOLD}${m.memUsage}${RESET}`,
      'git-branch': `🌿 ${BOLD}${m.gitBranch}${RESET}`,
      'vcs-dirty': `📝 ${getVcsDirtyColor(m.vcsDirtyFlag)}${BOLD}${m.vcsDirtyGlyph} ${m.vcsDirtyLabel}${RESET}`,
      'vcs-type': `🗂️ ${BOLD}${m.vcsType}${RESET}`,
      'project-path': `📁 ${BOLD}${m.projectName}${RESET}`,
      'project-full-path': `📁 ${BOLD}${m.projectFullPath}${RESET}`,
      'plan-tier': `👑 ${BOLD}${m.planTier}${RESET}`,
      'account-email': `👤 ${BOLD}${m.accountEmail}${RESET}`,
      'agent-profile': `🎭 ${BLUE}${BOLD}${m.agentProfileName} ロール${RESET}`,
      'agent-state': `⚙️ ${getAgentStateColor(m.agentState)}${BOLD}${m.agentStateLabel}${RESET}`,
      'tool-confirmation': `🔔 ${getToolConfirmColor(m.toolConfirmPending)}${BOLD}${m.toolConfirmPending ? '待機中' : '準備完了'}${RESET}`,
      'pending-input': `📥 ${getColorByCount(m.pendingInputCount)}${BOLD}${m.pendingInputCount}${RESET} キュー`,
      'background-tasks': `🔄 ${getColorByCount(m.backgroundTasksCount)}${BOLD}${m.backgroundTasksCount}${RESET} BGタスク`,
      'subagents': `👥 ${getColorByCount(m.subagentsCount)}${BOLD}${m.subagentsCount}${RESET} サブ代理`,
      'artifacts': `📦 ${BOLD}${m.artifactsCount}${RESET} 成果物`,
      'sandbox-status': `🛡️ ${getSandboxColor(m.sandboxEnabled, m.sandboxAllowNet)}${BOLD}${m.sandboxStatusVal}${RESET}`,
      'cli-version': `🏷️ ${BOLD}${m.cliVersion}${RESET}`,
      'conversation-id': `💬 ${BOLD}${m.conversationIdShort}${RESET}`,
      'mode': `🎯 ${getModeColor(m.mode)}${BOLD}${m.mode} モード${RESET}`
    }
  };
  return dicts[lang] || dicts['zh-cn'] || dicts['zh-tw'];
}

function renderStatusLine(footerItems, activeDict, termWidth) {
  const lines = [];
  let currentLine = '';
  
  for (let i = 0; i < footerItems.length; i++) {
    const item = footerItems[i];
    if (item === 'n' || item === 'newline') {
      if (currentLine !== '') {
        lines.push(currentLine);
        currentLine = '';
      } else {
        lines.push(' ');
      }
      continue;
    }

    const text = activeDict[item];
    if (!text) continue;

    const toAdd = currentLine === '' ? text : ` ${GRAY}│${RESET} ${text}`;
    const toAddPlain = stripAnsi(toAdd);
    const currentPlain = stripAnsi(currentLine);
    
    if (currentLine !== '' && getDisplayWidth(currentPlain) + getDisplayWidth(toAddPlain) > termWidth) {
      lines.push(currentLine);
      currentLine = text;
    } else {
      currentLine += (currentLine === '' ? text : ` ${GRAY}│${RESET} ${text}`);
    }
  }
  if (currentLine !== '') lines.push(currentLine);
  console.log(lines.join('\n'));
}

// ==========================================
// Main Entry
// ==========================================
async function main() {
  if (process.env.DISABLE_QUOTA_HOOK) process.exit(0);
  let meta = {};

  try {
    const stdinStr = await readStdin();
    try { if (stdinStr.trim()) meta = JSON.parse(stdinStr.replace(/^\uFEFF/, '')); } catch (e) {}

    const settings = await getSettingsAsync(meta);
    const termWidth = Math.max(40, (meta?.terminal_width || process.stdout.columns || 80) - 1);
    
    let fallbackModel = meta?.model?.display_name || meta?.model?.id || settings?.model || 'Gemini 3.7 Flash (High)';
    
    // 退讓模式
    if (!settings?.ui?.footer?.items) {
      const leftText = '? for shortcuts';
      const rightText = fallbackModel;
      const spacesCount = Math.max(1, termWidth - getDisplayWidth(leftText) - getDisplayWidth(rightText) - 1);
      console.log(`${leftText}${' '.repeat(spacesCount)}${rightText}`);
      process.exit(0);
    }
    
    const lang = settings?.ui?.language || 'zh-tw';
    const footerItems = settings.ui.footer.items;
    let conversationId = 'default';
    if (typeof meta?.conversation_id === 'string' && meta.conversation_id) {
      conversationId = meta.conversation_id.replace(/\.\./g, '').replace(/\//g, '').replace(/\\/g, '');
    }
    
    // 讀取快取並觸發更新
    const cachePath = join(os.homedir(), '.gemini', 'tmp', 'real_quota_cache.json');
    let cache = null;
    try {
      const cacheContent = await fs.readFile(cachePath, 'utf8');
      cache = JSON.parse(cacheContent.replace(/^\uFEFF/, ''));
    } catch (e) {}
    await triggerQuotaUpdateIfNeededAsync(cache);

    // 解析核心資料
    const quotaInfo = resolveModelQuota(fallbackModel, cache);
    const weeklyInfo = resolveWeeklyQuota(fallbackModel, cache);
    const contextInfo = await calculateContextUsageAsync(meta, conversationId);
    const cachedAccount = await manageAccountMetaCacheAsync(meta);

    // 格式化指標並繪製
    const metrics = await extractMetricsAsync(meta, lang, fallbackModel, cache, cachedAccount, quotaInfo, contextInfo, weeklyInfo);
    const activeDict = buildI18nDict(lang, metrics);
    renderStatusLine(footerItems, activeDict, termWidth);

  } catch (err) {
    try {
      const projectLogDir = join(process.cwd(), '.gemini');
      await fs.access(projectLogDir);
      await fs.writeFile(join(projectLogDir, 'hook_error.log'), `[${new Date().toISOString()}] ${err.stack || err.message}\n`, { encoding: 'utf8', flag: 'a' });
    } catch (e) {}
    
    let fallbackModel = meta?.model?.display_name || meta?.model?.id || 'Gemini 3.7 Flash (High)';
    console.log(`? for shortcuts | ${fallbackModel}`);
  }
  process.exit(0);
}

main();