// scripts/colab_bridge/nl_dispatcher.js
/**
 * ====================================================================
 * BHUSAWAL CONNECT — NATURAL LANGUAGE COMMAND DISPATCHER
 * ====================================================================
 * Parses natural-language user prompts and executes the corresponding
 * Colab job lifecycle operations automatically without manual npm commands.
 */

import { JobManager } from './job_manager.js';

export class NaturalLanguageDispatcher {
  constructor(config = {}) {
    this.manager = new JobManager(config);
  }

  /**
   * Parses natural-language string into structured intent
   */
  parsePrompt(promptText) {
    const raw = (promptText || '').trim();
    const text = raw.toLowerCase();

    // 1. Status / Show current job
    if (
      text.includes('show') && (text.includes('job') || text.includes('status') || text.includes('current')) ||
      text.includes('status') ||
      text === 'what is the current job'
    ) {
      return { action: 'STATUS', raw };
    }

    // 2. Cancel current job
    if (text.includes('cancel') && (text.includes('job') || text.includes('current') || text.includes('running'))) {
      return { action: 'CANCEL', raw };
    }

    // 3. Resume / Retry failed job
    if (text.includes('resume') || (text.includes('retry') && text.includes('job'))) {
      return { action: 'RESUME', raw };
    }

    // 4. Show failed products
    if (text.includes('show') && text.includes('failed')) {
      return { action: 'SHOW_FAILED', raw };
    }

    // 5. Verify existing images
    if (text.includes('verify') && (text.includes('image') || text.includes('catalogue') || text.includes('catalog'))) {
      const numMatch = text.match(/\b(\d+)\b/);
      const limit = numMatch ? parseInt(numMatch[1]) : 50;
      return {
        action: 'CREATE_JOB',
        task: 'VERIFY_PRODUCT_IMAGES',
        limit,
        summary: `Verify product images (${limit} items)`,
        raw
      };
    }

    // 6. Regenerate rejected images
    if (text.includes('regenerate') && (text.includes('reject') || text.includes('failed'))) {
      return {
        action: 'CREATE_JOB',
        task: 'GENERATE_PRODUCT_IMAGES',
        filter: 'REJECTED_ONLY',
        limit: 50,
        summary: 'Regenerate rejected product images',
        raw
      };
    }

    // 7. Generate missing images
    if (text.includes('generate') && (text.includes('missing') || text.includes('without image'))) {
      const numMatch = text.match(/\b(\d+)\b/);
      const limit = numMatch ? parseInt(numMatch[1]) : 50;
      return {
        action: 'CREATE_JOB',
        task: 'GENERATE_PRODUCT_IMAGES',
        filter: 'MISSING_ONLY',
        limit,
        summary: `Generate missing images (${limit} items)`,
        raw
      };
    }

    // 8. Update catalogue
    if (text.includes('update') && (text.includes('catalogue') || text.includes('catalog') || text.includes('sheet'))) {
      return {
        action: 'CREATE_JOB',
        task: 'UPDATE_CATALOG',
        limit: 100,
        summary: 'Update catalogue with verified images',
        raw
      };
    }

    // 9. Process range: e.g. "Process products 1 to 100"
    const rangeMatch = text.match(/process\s+products?\s+(\d+)\s+to\s+(\d+)/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = parseInt(rangeMatch[2]);
      const limit = Math.max(1, end - start + 1);
      return {
        action: 'CREATE_JOB',
        task: 'PROCESS_CATALOG',
        range_start: start,
        range_end: end,
        limit,
        summary: `Process products range ${start} to ${end}`,
        raw
      };
    }

    // 10. General Process N products / Process all unverified
    const countMatch = text.match(/(\d+)\s*products?/);
    const limit = countMatch ? parseInt(countMatch[1]) : (text.includes('all') ? 100 : 5);
    const isUnverified = text.includes('unverified') || text.includes('pending');

    return {
      action: 'CREATE_JOB',
      task: 'PROCESS_CATALOG',
      limit,
      filter: isUnverified ? 'UNVERIFIED_ONLY' : 'ALL',
      summary: `Process ${limit} products and generate accurate images`,
      raw
    };
  }

  /**
   * Executes the resolved intent
   */
  async executePrompt(promptText, extraConfig = {}) {
    const intent = this.parsePrompt(promptText);

    switch (intent.action) {
      case 'STATUS': {
        const jobs = await this.manager.listJobs(extraConfig.sheetId);
        if (jobs.length === 0) {
          return { success: true, message: 'No jobs found in queue.' };
        }
        const latest = jobs[0];
        const status = await this.manager.getJobStatus(latest.job_id, extraConfig.sheetId);
        return {
          success: true,
          action: 'STATUS',
          job: status,
          formatted: this.formatJobReport(status)
        };
      }

      case 'CANCEL': {
        const jobs = await this.manager.listJobs(extraConfig.sheetId);
        const active = jobs.find(j => j.status === 'RUNNING' || j.status === 'QUEUED') || jobs[0];
        if (!active) {
          return { success: false, message: 'No active or queued job found to cancel.' };
        }
        const cancelled = await this.manager.cancelJob(active.job_id, extraConfig.sheetId);
        return {
          success: true,
          action: 'CANCEL',
          job: cancelled,
          message: `Job ${active.job_id} has been CANCELLED.`
        };
      }

      case 'RESUME': {
        const jobs = await this.manager.listJobs(extraConfig.sheetId);
        const failed = jobs.find(j => j.status === 'FAILED' || j.status === 'CANCELLED') || jobs[0];
        if (!failed) {
          return { success: false, message: 'No failed job found to resume.' };
        }
        const resumed = await this.manager.resumeJob(failed.job_id, extraConfig.sheetId);
        return {
          success: true,
          action: 'RESUME',
          job: resumed,
          message: `Job ${failed.job_id} has been reset to QUEUED.`
        };
      }

      case 'CREATE_JOB':
      default: {
        const job = await this.manager.createJob(intent.task, {
          limit: intent.limit || 5,
          range_start: intent.range_start || 1,
          range_end: intent.range_end || intent.limit,
          filter: intent.filter || 'ALL',
          description: intent.summary || promptText,
          sheetId: extraConfig.sheetId
        });

        return {
          success: true,
          action: 'CREATE_JOB',
          job,
          message: `Job ${job.job_id} created (${job.task}, ${job.total_items} items). Status: QUEUED.`
        };
      }
    }
  }

  /**
   * Formats a clean terminal report
   */
  formatJobReport(job) {
    return `
========================================
📊 BHUSAWAL CONNECT JOB REPORT
========================================
Job ID:       ${job.job_id}
Task:         ${job.task}
Status:       ${job.status}
Progress:     ${job.completed_items || 0}/${job.total_items || 0} (${job.progress || '0%'})
Completed:    ${job.completed_items || 0}
Failed:       ${job.failed_items || 0}
Pending:      ${job.pending_items || Math.max(0, (job.total_items || 0) - (job.completed_items || 0))}
Current Item: ${job.current_product || 'None'}
Created At:   ${job.created_at || 'N/A'}
Started At:   ${job.started_at || 'N/A'}
Completed At: ${job.completed_at || 'N/A'}
Summary:      ${job.summary || ''}
${job.error ? `Error:        ${job.error}\n` : ''}========================================`;
  }
}
