#!/usr/bin/env node
// scripts/colab_bridge/cli.js
/**
 * ====================================================================
 * BHUSAWAL CONNECT — ANTIGRAVITY COLAB BRIDGE CLI
 * ====================================================================
 * Unified CLI with Natural Language Interface, Watch Mode, and
 * Queue Operations.
 */

import { JobManager } from './job_manager.js';
import { NaturalLanguageDispatcher } from './nl_dispatcher.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const options = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextVal = args[i + 1];
      if (nextVal && !nextVal.startsWith('--')) {
        options[key] = nextVal;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return { command, options, rawArgs: args };
}

function showHelp() {
  console.log(`
====================================================================
  BHUSAWAL CONNECT — NATURAL LANGUAGE COLAB BRIDGE CLI
====================================================================

Usage:
  node scripts/colab_bridge/cli.js <command> [options]
  npm run colab -- "<NATURAL LANGUAGE PROMPT>"

Natural Language Commands (No flags required):
  npm run colab -- "Process 50 products."
  npm run colab -- "Generate images for all products without images."
  npm run colab -- "Verify the existing product images."
  npm run colab -- "Process products 1 to 100."
  npm run colab -- "Show me the current Colab job."
  npm run colab -- "Cancel the current job."
  npm run colab -- "Resume the failed job."

Standard Commands:
  ask "<PROMPT>"  Parse and execute a natural-language command
  init-sheet      Initialize Google Sheet with 7 columns and queue tabs
  push-catalog    Push local catalogue items to Google Sheet (--limit <N>)
  create-job      Create a new processing job (--task <TYPE> --limit <N>)
  status          Check status of a job (--job-id <ID>)
  watch           Live monitor a job until completion (--job-id <ID>)
  cancel          Cancel an active job (--job-id <ID>)
  resume          Resume or retry a job (--job-id <ID>)
  list            List all jobs in queue
  help            Show this help menu
====================================================================
`);
}

async function main() {
  const { command, options, rawArgs } = parseArgs();
  const manager = new JobManager({
    sheetId: options['sheet-id'],
    driveFolderId: options['drive-folder-id']
  });
  const dispatcher = new NaturalLanguageDispatcher({
    sheetId: options['sheet-id'],
    driveFolderId: options['drive-folder-id']
  });

  try {
    switch (command.toLowerCase()) {
      case 'ask': {
        const promptText = rawArgs.slice(1).filter(a => !a.startsWith('--')).join(' ');
        if (!promptText) {
          console.error('❌ Please provide a prompt, e.g.: npm run colab -- "Process 50 products."');
          process.exit(1);
        }
        console.log(`\n💬 Natural Language Prompt: "${promptText}"`);
        const res = await dispatcher.executePrompt(promptText, { sheetId: options['sheet-id'] });

        if (res.formatted) {
          console.log(res.formatted);
        } else if (res.job) {
          console.log(`\n========================================================`);
          console.log(`✅ JOB DISPATCHED SUCCESSFULLY`);
          console.log(`   Job ID:       ${res.job.job_id}`);
          console.log(`   Task:         ${res.job.task}`);
          console.log(`   Status:       ${res.job.status}`);
          console.log(`   Total Items:  ${res.job.total_items}`);
          console.log(`   Created At:   ${res.job.created_at}`);
          console.log(`========================================================\n`);
          console.log(`👉 Colab worker will claim and process this job.`);
          console.log(`👉 Run 'node scripts/colab_bridge/cli.js watch --job-id ${res.job.job_id}' to monitor.\n`);
        } else {
          console.log(res.message || 'Operation completed.');
        }
        break;
      }

      case 'init-sheet': {
        const sheetId = options['sheet-id'] || manager.sheetId;
        if (!sheetId) {
          console.error('❌ Error: Missing --sheet-id or GOOGLE_SHEET_ID in .env');
          process.exit(1);
        }
        const res = await manager.initSheet(sheetId);
        console.log('Result:', JSON.stringify(res, null, 2));
        break;
      }

      case 'push-catalog': {
        const sheetId = options['sheet-id'] || manager.sheetId;
        const limit = parseInt(options.limit) || 50;
        const res = await manager.pushCatalogToSheet(sheetId, { limit });
        console.log(`✅ Pushed ${res.count} items to Google Sheet.`);
        break;
      }

      case 'create-job': {
        const task = options.task || 'PROCESS_CATALOG';
        const limit = parseInt(options.limit) || 50;
        const job = await manager.createJob(task, {
          limit,
          sheetId: options['sheet-id']
        });
        console.log(`\n========================================================`);
        console.log(`✅ JOB CREATED: ${job.job_id} [${job.task}]`);
        console.log(`   Status:  ${job.status} (${job.total_items} items)`);
        console.log(`========================================================\n`);
        break;
      }

      case 'status': {
        const jobId = options['job-id'];
        if (!jobId) {
          console.error('❌ Error: Missing --job-id');
          process.exit(1);
        }
        const status = await manager.getJobStatus(jobId, options['sheet-id']);
        console.log(dispatcher.formatJobReport(status));
        break;
      }

      case 'watch': {
        const jobId = options['job-id'];
        if (!jobId) {
          console.error('❌ Error: Missing --job-id');
          process.exit(1);
        }
        console.log(`\n👀 Live Watching Job ${jobId}... (Press Ctrl+C to exit)\n`);

        while (true) {
          const status = await manager.getJobStatus(jobId, options['sheet-id']);
          console.clear();
          console.log(dispatcher.formatJobReport(status));
          console.log(`\nLast refreshed: ${new Date().toLocaleTimeString()} (Polling every 3s)...`);

          if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status.status)) {
            console.log(`\n🎯 Job reached terminal state: ${status.status}`);
            break;
          }

          await new Promise(r => setTimeout(r, 3000));
        }
        break;
      }

      case 'cancel': {
        const jobId = options['job-id'];
        if (!jobId) {
          console.error('❌ Error: Missing --job-id');
          process.exit(1);
        }
        const res = await manager.cancelJob(jobId, options['sheet-id']);
        console.log(`✅ Job ${jobId} has been CANCELLED.`);
        break;
      }

      case 'resume': {
        const jobId = options['job-id'];
        if (!jobId) {
          console.error('❌ Error: Missing --job-id');
          process.exit(1);
        }
        const res = await manager.resumeJob(jobId, options['sheet-id']);
        console.log(`✅ Job ${jobId} has been reset to QUEUED.`);
        break;
      }

      case 'list': {
        const jobs = await manager.listJobs(options['sheet-id']);
        console.log(`\nFound ${jobs.length} job(s):`);
        console.table(jobs);
        break;
      }

      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (err) {
    console.error(`\n❌ Error:`, err.message);
    process.exit(1);
  }
}

main();
