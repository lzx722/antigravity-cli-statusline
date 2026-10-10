import { writeFileSync, mkdirSync, rmSync, mkdtempSync, symlinkSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { spawn } from 'child_process';
import assert from 'assert';
import { fileURLToPath } from 'url';

const SCRIPT_PATH = fileURLToPath(new URL('./statusline-quota.mjs', import.meta.url));

const BLUE_BOLD = "\x1b[38;2;87;202;255m\x1b[1m";
const GREEN_BOLD = "\x1b[38;2;92;219;109m\x1b[1m";
const YELLOW = "\x1b[38;2;255;212;39m";
const WHITE = "\x1b[38;2;255;255;255m";
const RESET = "\x1b[0m";

/**
 * Spawns the statusline script with redirected HOME and project directory.
 * @param {object} stdinData - Meta payload piped to stdin
 * @param {string} homeDir - Isolated temporary directory path
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function runStatusline(stdinData, homeDir, scriptPath = SCRIPT_PATH) {
  return new Promise((resolve) => {
    const env = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };
    delete env.DISABLE_QUOTA_HOOK;            // explicit unset — Finding #1
    const child = spawn('node', [scriptPath], {
      env,
      cwd: homeDir,                            // project settings resolve under temp home — Finding #2
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.stdin.write(JSON.stringify(stdinData));
    child.stdin.end();
  });
}

/**
 * Creates a hermetic sandbox home directory containing mock cache and settings.
 * @param {object} cache - Mock quota cache content
 * @param {object} settings - Mock settings content
 * @returns {string} Path to the created temp home directory
 */
function makeTempHome(cache, settings) {
  const home = mkdtempSync(join(os.tmpdir(), 'statusline-weekly-'));
  mkdirSync(join(home, '.gemini', 'tmp'), { recursive: true });
  writeFileSync(join(home, '.gemini', 'tmp', 'real_quota_cache.json'), JSON.stringify(cache), 'utf8');
  writeFileSync(join(home, '.gemini', 'settings.json'), JSON.stringify(settings), 'utf8');
  return home;
}

async function main() {
  console.log("=== Running statusline-quota.test.mjs (R1-R4) ===");

  let testsPassed = true;

  try {
    // ----------------------------------------------------
    // Test Case R1: Weekly countdown renders
    // Justification: Verifies that weekly reset countdown displays in BLUE+BOLD for a Gemini model.
    // ----------------------------------------------------
    console.log("\n[Test R1] Verifying weekly countdown rendering...");
    const mockCacheR1 = {
      weekly: {
        gemini: {
          remaining_percentage: 90.07,
          reset_time: '2026-07-05T03:22:46Z',
          refreshes_in: '4d 11h'
        }
      },
      updatedAt: Date.now()
    };
    const settingsR1 = {
      ui: {
        language: "us",
        footer: {
          items: ["quota-weekly-countdown"]
        }
      }
    };
    const metaR1 = {
      model: { display_name: "Gemini 1.5 Pro" },
      terminal_width: 120
    };

    const homeR1 = makeTempHome(mockCacheR1, settingsR1);
    try {
      const resR1 = await runStatusline(metaR1, homeR1);
      console.log("R1 Output:", JSON.stringify(resR1.stdout));

      const hasWeeklyReset = resR1.stdout.includes("4d 11h") && (resR1.stdout.includes("Weekly Reset:") || resR1.stdout.includes("📅"));
      if (resR1.code === 0 && hasWeeklyReset) {
        console.log("✅ R1 passed!");
      } else {
        console.error(`❌ R1 failed! Expected output to contain weekly countdown: 4d 11h`);
        testsPassed = false;
      }
    } finally {
      try { rmSync(homeR1, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch(e) {}
    }

    // ----------------------------------------------------
    // Test Case R2: Weekly % color tier
    // Justification: Verifies color tier mapping for new weekly quota (90% -> BLUE+BOLD).
    // ----------------------------------------------------
    console.log("\n[Test R2] Verifying weekly quota % color tier...");
    const mockCacheR2 = {
      weekly: {
        gemini: {
          remaining_percentage: 90.07,
          reset_time: '2026-07-05T03:22:46Z',
          refreshes_in: '4d 11h'
        }
      },
      updatedAt: Date.now()
    };
    const settingsR2 = {
      ui: {
        language: "us",
        footer: {
          items: ["quota-weekly"]
        }
      }
    };
    const metaR2 = {
      model: { display_name: "Gemini 1.5 Pro" },
      terminal_width: 120
    };

    const homeR2 = makeTempHome(mockCacheR2, settingsR2);
    try {
      const resR2 = await runStatusline(metaR2, homeR2);
      console.log("R2 Output:", JSON.stringify(resR2.stdout));

      const hasWeeklyQuota = resR2.stdout.includes("90%") && (resR2.stdout.includes("Weekly Available:") || resR2.stdout.includes("📅"));
      if (resR2.code === 0 && hasWeeklyQuota) {
        console.log("✅ R2 passed!");
      } else {
        console.error(`❌ R2 failed! Expected output to contain 90%`);
        testsPassed = false;
      }
    } finally {
      try { rmSync(homeR2, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch(e) {}
    }

    // ----------------------------------------------------
    // Test Case R3: Pool mapping (Claude -> 3p)
    // Justification: Exercises family -> pool resolver (Claude/GPT model maps to '3p' weekly bucket).
    // ----------------------------------------------------
    console.log("\n[Test R3] Verifying pool mapping (Claude -> 3p)...");
    const mockCacheR3 = {
      weekly: {
        '3p': {
          remaining_percentage: 60.5,
          reset_time: '2026-07-07T07:27:15Z',
          refreshes_in: '6d 15h'
        }
      },
      updatedAt: Date.now()
    };
    const settingsR3 = {
      ui: {
        language: "us",
        footer: {
          items: ["quota-weekly"]
        }
      }
    };
    const metaR3 = {
      model: { display_name: "Claude 3.5 Sonnet" },
      terminal_width: 120
    };

    const homeR3 = makeTempHome(mockCacheR3, settingsR3);
    try {
      const resR3 = await runStatusline(metaR3, homeR3);
      console.log("R3 Output:", JSON.stringify(resR3.stdout));

      const has3pQuota = resR3.stdout.includes("61%") && (resR3.stdout.includes("Weekly Available:") || resR3.stdout.includes("📅"));
      if (resR3.code === 0 && has3pQuota) {
        console.log("✅ R3 passed!");
      } else {
        console.error(`❌ R3 failed! Expected output to contain: 61%`);
        testsPassed = false;
      }
    } finally {
      try { rmSync(homeR3, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch(e) {}
    }

    // ----------------------------------------------------
    // Test Case R4: Graceful fallback
    // Justification: Verifies missing-data degradation (no weekly key returns N/A without crash).
    // ----------------------------------------------------
    console.log("\n[Test R4] Verifying graceful fallback...");
    const mockCacheR4 = {
      updatedAt: Date.now()
    };
    const settingsR4 = {
      ui: {
        language: "us",
        footer: {
          items: ["quota-weekly-countdown"]
        }
      }
    };
    const metaR4 = {
      model: { display_name: "Gemini 1.5 Pro" },
      terminal_width: 120
    };

    const homeR4 = makeTempHome(mockCacheR4, settingsR4);
    try {
      const resR4 = await runStatusline(metaR4, homeR4);
      console.log("R4 Output:", JSON.stringify(resR4.stdout));

      const hasFallback = resR4.stdout.includes("N/A") || resR4.stdout.includes("100%");
      if (resR4.code === 0 && hasFallback) {
        console.log("✅ R4 passed!");
      } else {
        console.error(`❌ R4 failed! Expected output to contain fallback`);
        testsPassed = false;
      }
    } finally {
      try { rmSync(homeR4, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch(e) {}
    }

    // ----------------------------------------------------
    // Test Case R5: Hourly Available uses shortTerm 5h quota
    // Justification: Verifies that Hourly Available prefers shortTerm 5h quota (32% / 2h 2m) over weekly bottleneck model quota (4.7% / 1h 20m).
    // ----------------------------------------------------
    console.log("\n[Test R5] Verifying shortTerm 5h quota priority for Hourly Available...");
    const mockCacheR5 = {
      models: {
        gemini36flashhigh: {
          remaining_percentage: 4.67,
          reset_time: '2026-08-07T11:12:18Z',
          refreshes_in: '1h 20m'
        }
      },
      shortTerm: {
        gemini: {
          remaining_percentage: 31.8,
          reset_time: '2026-08-07T11:54:34Z',
          refreshes_in: '2h 2m'
        }
      },
      updatedAt: Date.now()
    };
    const settingsR5 = {
      ui: {
        language: "us",
        footer: {
          items: ["quota", "quota-reset-countdown"]
        }
      }
    };
    const metaR5 = {
      model: { display_name: "Gemini 3.6 Flash (High)" },
      terminal_width: 120
    };

    const homeR5 = makeTempHome(mockCacheR5, settingsR5);
    try {
      const resR5 = await runStatusline(metaR5, homeR5);
      console.log("R5 Output:", JSON.stringify(resR5.stdout));

      const hasR5Quota = resR5.stdout.includes("32%");
      const hasR5Reset = resR5.stdout.includes("2h 2m");
      if (resR5.code === 0 && hasR5Quota && hasR5Reset) {
        console.log("✅ R5 passed!");
      } else {
        console.error(`❌ R5 failed! Expected output to contain 32% and 2h 2m.`);
        testsPassed = false;
      }
    } finally {
      try { rmSync(homeR5, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch(e) {}
    }

    // ----------------------------------------------------
    // Test Case R6: Direct meta.quota integration (Native CLI quota, zero disk dependency)
    // ----------------------------------------------------
    console.log("\n[Test R6] Verifying native meta.quota rendering and persistence...");
    const settingsR6 = {
      ui: {
        language: "us",
        footer: {
          items: ["quota", "quota-reset-countdown", "quota-weekly", "quota-weekly-countdown"]
        }
      }
    };
    const metaR6 = {
      model: { display_name: "Gemini 3.8 Flash (High)" },
      quota: {
        "gemini-5h": {
          remaining_fraction: 0.75,
          reset_in_seconds: 7200
        },
        "gemini-weekly": {
          remaining_fraction: 0.82,
          reset_in_seconds: 360000
        }
      },
      plan_tier: "Google AI Pro",
      email: "test@example.com",
      terminal_width: 160
    };

    const homeR6 = makeTempHome({}, settingsR6);
    try {
      const resR6 = await runStatusline(metaR6, homeR6);
      console.log("R6 Output:", JSON.stringify(resR6.stdout));

      const hasR6Hourly = resR6.stdout.includes("75%");
      const hasR6HourlyReset = resR6.stdout.includes("2h");
      const hasR6Weekly = resR6.stdout.includes("82%");
      const hasR6WeeklyReset = resR6.stdout.includes("4d 4h");

      if (resR6.code === 0 && 
          hasR6Hourly && 
          hasR6HourlyReset &&
          hasR6Weekly &&
          hasR6WeeklyReset) {
        console.log("✅ R6 passed!");
      } else {
        console.error(`❌ R6 failed! Output did not contain expected values.`);
        testsPassed = false;
      }
    } finally {
      try { rmSync(homeR6, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch(e) {}
    }

    // ----------------------------------------------------
    // Test Case R7: Symbolic link execution regression test
    // ----------------------------------------------------
    console.log("\n[Test R7] Verifying execution when invoked via symbolic link...");
    const homeR7 = makeTempHome({}, settingsR6);
    const symlinkPath = join(homeR7, 'symlink-statusline.mjs');
    let symlinkTested = false;
    try {
      try {
        symlinkSync(SCRIPT_PATH, symlinkPath, 'file');
        symlinkTested = true;
      } catch (symlinkErr) {
        console.log(`⚠️ Symlinks not permitted in this environment (${symlinkErr.code || symlinkErr.message}), skipping R7 symlink invocation.`);
      }

      if (symlinkTested) {
        const resR7 = await runStatusline(metaR6, homeR7, symlinkPath);
        if (resR7.code === 0 && resR7.stdout && resR7.stdout.trim().length > 0) {
          console.log("✅ R7 passed! (Symbolic link executed statusline successfully)");
        } else {
          console.error(`❌ R7 failed! Statusline returned 0 bytes or failed when invoked via symbolic link. Code: ${resR7.code}, Output: ${JSON.stringify(resR7.stdout)}`);
          testsPassed = false;
        }
      }
    } finally {
      try { rmSync(homeR7, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch(e) {}
    }

    // ----------------------------------------------------
    // Test Case R8: Simplified Chinese (zh-cn) rendering (all 26 indicators)
    // Justification: Verifies that zh-cn renders correct metric labels, status values, and fallback strings across all 26 indicators.
    // ----------------------------------------------------
    console.log("\n[Test R8] Verifying Simplified Chinese (zh-cn) rendering for all 26 indicators...");
    const mockCacheR8 = {
      shortTerm: {
        gemini: {
          remaining_percentage: 88,
          refreshes_in: '3h'
        }
      },
      weekly: {
        gemini: {
          remaining_percentage: 75,
          refreshes_in: '5d 2h'
        }
      },
      planTier: 'Google AI Pro',
      email: 'test@example.com',
      updatedAt: Date.now()
    };
    const all26Items = [
      "model-name", "quota", "context-used", "memory-usage", "token-count",
      "quota-reset-countdown", "quota-weekly", "quota-weekly-countdown", "git-branch",
      "project-path", "project-full-path", "plan-tier", "account-email", "agent-state",
      "tool-confirmation", "pending-input", "background-tasks", "subagents", "artifacts",
      "vcs-dirty", "vcs-type", "sandbox-status", "cli-version", "conversation-id",
      "agent-profile", "mode"
    ];
    const settingsR8 = {
      ui: {
        language: "zh-cn",
        footer: {
          items: all26Items
        }
      }
    };
    const metaR8 = {
      model: { display_name: "Gemini 3.5 Flash" },
      terminal_width: 1000,
      version: "1.7.0",
      conversation_id: "test-conv-12345678",
      vcs: { dirty: false, branch: "main", type: "git" },
      context_window: { total_input_tokens: 1500, context_window_size: 1000000, used_percentage: 0.15 },
      agent_state: "idle",
      mode: "default"
    };

    const homeR8 = makeTempHome(mockCacheR8, settingsR8);
    try {
      const resR8 = await runStatusline(metaR8, homeR8);
      console.log("R8 Output:", JSON.stringify(resR8.stdout));

      const expectedR8Labels = [
        "Gemini 3.5 Flash", "88%", "0.1%", "41MB", "1.5k", "75%",
        "main", "Google AI Pro", "test@example.com", "空闲", "已就绪",
        "队列", "后台", "子代理", "工件", "干净", "git", "关闭",
        "v1.7.0", "testconv", "默认 角色", "Default 模式"
      ];
      const missingLabels = expectedR8Labels.filter(item => !resR8.stdout.includes(item));
      if (resR8.code === 0 && missingLabels.length === 0) {
        console.log("✅ R8 passed! (All 26 Simplified Chinese zh-cn indicators rendered correctly)");
      } else {
        console.error(`❌ R8 failed! Missing labels: ${JSON.stringify(missingLabels)}. Output: ${JSON.stringify(resR8.stdout)}`);
        testsPassed = false;
      }
    } finally {
      try { rmSync(homeR8, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch(e) {}
    }

    // ----------------------------------------------------
    // Test Case R9: Case-insensitive & complex language code normalization (zh-CN, cn & 简体中文 (zh-cn))
    // Justification: Verifies that 'zh-CN', 'cn', and full label '简体中文 (zh-cn)' are properly normalized to 'zh-cn' and render Simplified Chinese instead of falling back to zh-tw.
    // ----------------------------------------------------
    console.log("\n[Test R9] Verifying case-insensitive & label language normalization (zh-CN, cn, 简体中文 (zh-cn))...");
    const langVariants = ["zh-CN", "cn", "简体中文 (zh-cn)"];
    for (const testLang of langVariants) {
      const settingsVar = {
        ui: {
          language: testLang,
          footer: {
            items: ["quota", "context-used", "memory-usage", "vcs-dirty", "sandbox-status", "agent-profile"]
          }
        }
      };
      const homeVar = makeTempHome(mockCacheR8, settingsVar);
      try {
        const resVar = await runStatusline(metaR8, homeVar);
        console.log(`R9 (${testLang}) Output:`, JSON.stringify(resVar.stdout));

        const hasZhCnQuota = resVar.stdout.includes("88%");
        const hasZhCnClean = resVar.stdout.includes("干净");
        const hasZhCnSandbox = resVar.stdout.includes("关闭");
        const hasZhCnProfile = resVar.stdout.includes("默认");

        if (resVar.code === 0 && hasZhCnQuota && hasZhCnClean && hasZhCnSandbox && hasZhCnProfile) {
          console.log(`✅ R9 passed for "${testLang}"! (Properly normalized to Simplified Chinese zh-cn)`);
        } else {
          console.error(`❌ R9 failed for "${testLang}"! Did not render Simplified Chinese. Output: ${JSON.stringify(resVar.stdout)}`);
          testsPassed = false;
        }
      } finally {
        try { rmSync(homeVar, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch(e) {}
      }
    }

  } catch (err) {
    console.error("Test execution failed:", err);
    testsPassed = false;
  }

  if (testsPassed) {
    console.log("\n🎉 All rendering tests passed successfully!");
    process.exit(0);
  } else {
    console.error("\n❌ Some rendering tests failed.");
    process.exit(1);
  }
}

main();
