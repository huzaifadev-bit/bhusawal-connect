// scripts/colab_bridge/job_manager.js
/**
 * ====================================================================
 * BHUSAWAL CONNECT — ASYNC JOB MANAGER & COLAB ORCHESTRATION
 * ====================================================================
 * Manages job lifecycle, queue management, progress reporting, and
 * bidirectional catalog syncing between Antigravity and Google Colab.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  GoogleApiClient,
  REQUIRED_CATALOGUE_HEADERS,
  JOB_QUEUE_HEADERS,
  JOB_LOG_HEADERS,
  ALLOWED_JOB_STATUSES,
  ALLOWED_TASKS
} from './google_client.js';

const JOBS_DIR = path.resolve(process.cwd(), '.jobs');

export class JobManager {
  constructor(config = {}) {
    this.client = new GoogleApiClient(config);
    this.sheetId = config.sheetId || this.client.sheetId;
    this.driveFolderId = config.driveFolderId || this.client.driveFolderId;

    if (!fs.existsSync(JOBS_DIR)) {
      fs.mkdirSync(JOBS_DIR, { recursive: true });
    }
  }

  /**
   * Generates a unique, human-readable Job ID
   */
  _generateJobId() {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `JOB-${dateStr}-${rand}`;
  }

  /**
   * Initializes the Google Sheet with required tabs and standardized columns
   */
  async initSheet(sheetId = this.sheetId) {
    if (!sheetId) throw new Error('Sheet ID is required to initialize catalogue tabs.');

    console.log(`[JobManager] Initializing Google Sheet ${sheetId}...`);

    try {
      const spreadsheet = await this.client.getSpreadsheet(sheetId);
      const existingSheets = spreadsheet.sheets.map(s => s.properties.title);

      const requests = [];
      const tabsToAdd = [
        { title: 'Product_Catalogue', headers: REQUIRED_CATALOGUE_HEADERS },
        { title: '_Jobs_Queue', headers: JOB_QUEUE_HEADERS },
        { title: '_Job_Logs', headers: JOB_LOG_HEADERS }
      ];

      for (const tab of tabsToAdd) {
        if (!existingSheets.includes(tab.title)) {
          requests.push({
            addSheet: {
              properties: {
                title: tab.title,
                gridProperties: { rowCount: 1000, columnCount: tab.headers.length + 5 }
              }
            }
          });
        }
      }

      if (requests.length > 0) {
        await this.client.batchUpdateSpreadsheet(requests, sheetId);
      }

      // Update headers for each tab
      for (const tab of tabsToAdd) {
        const colLetter = String.fromCharCode(64 + Math.min(26, tab.headers.length));
        await this.client.updateSheetValues(`${tab.title}!A1:${colLetter}1`, [tab.headers], sheetId);
      }

      console.log(`[JobManager] ✅ Sheet initialized successfully with 7 required catalogue fields and queue tabs.`);
      return { success: true, sheetId, initializedTabs: tabsToAdd.map(t => t.title) };
    } catch (err) {
      console.warn(`[JobManager] Sheet initialization notice: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Creates a new background job for Google Colab to execute
   */
  async createJob(task = 'PROCESS_CATALOG', config = {}) {
    const normalizedTask = ALLOWED_TASKS.includes(task.toUpperCase()) ? task.toUpperCase() : 'PROCESS_CATALOG';
    const jobId = this._generateJobId();
    const now = new Date().toISOString();
    const totalCount = config.limit || config.total_items || config.totalCount || 50;

    const jobRecord = {
      job_id: jobId,
      task: normalizedTask,
      created_at: now,
      status: 'QUEUED',
      progress: '0%',
      total_items: totalCount,
      completed_items: 0,
      failed_items: 0,
      pending_items: totalCount,
      current_product: 'None',
      error: '',
      started_at: '',
      completed_at: '',
      summary: config.description || config.summary || `Antigravity job: ${normalizedTask} (${totalCount} items)`,
      sheet_id: config.sheetId || this.sheetId,
      drive_folder_id: config.driveFolderId || this.driveFolderId,
      range_start: config.range_start || 1,
      range_end: config.range_end || totalCount,
      filter: config.filter || 'ALL'
    };

    // 1. Save local job manifest
    const localJobFile = path.join(JOBS_DIR, `${jobId}.json`);
    fs.writeFileSync(localJobFile, JSON.stringify(jobRecord, null, 2), 'utf8');

    // 2. Queue in Google Sheet _Jobs_Queue if sheet is accessible
    if (jobRecord.sheet_id) {
      try {
        const row = [
          jobRecord.job_id,
          jobRecord.task,
          jobRecord.created_at,
          jobRecord.status,
          jobRecord.progress,
          jobRecord.total_items,
          jobRecord.completed_items,
          jobRecord.failed_items,
          jobRecord.pending_items,
          jobRecord.current_product,
          jobRecord.error,
          jobRecord.started_at,
          jobRecord.completed_at,
          jobRecord.summary
        ];

        await this.client.appendSheetValues('_Jobs_Queue!A:N', [row], jobRecord.sheet_id);
        console.log(`[JobManager] ✅ Job ${jobId} successfully registered in Google Sheet _Jobs_Queue.`);
      } catch (err) {
        // Will be claimed by Colab via local queue / auth
      }
    }

    return jobRecord;
  }

  /**
   * Checks the status and progress of a job
   */
  async getJobStatus(jobId, sheetId = this.sheetId) {
    let localRecord = null;
    const localJobFile = path.join(JOBS_DIR, `${jobId}.json`);
    if (fs.existsSync(localJobFile)) {
      try {
        localRecord = JSON.parse(fs.readFileSync(localJobFile, 'utf8'));
      } catch (e) {}
    }

    // Try fetching live status from Google Sheet _Jobs_Queue
    if (sheetId) {
      try {
        const rows = await this.client.getSheetValues('_Jobs_Queue!A:N', sheetId);
        if (rows && rows.length > 1) {
          for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === jobId) {
              const remoteRecord = {
                job_id: rows[i][0],
                task: rows[i][1] || 'PROCESS_CATALOG',
                created_at: rows[i][2],
                status: rows[i][3] || 'QUEUED',
                progress: rows[i][4] || '0%',
                total_items: parseInt(rows[i][5]) || 0,
                completed_items: parseInt(rows[i][6]) || 0,
                failed_items: parseInt(rows[i][7]) || 0,
                pending_items: parseInt(rows[i][8]) || 0,
                current_product: rows[i][9] || '',
                error: rows[i][10] || '',
                started_at: rows[i][11] || '',
                completed_at: rows[i][12] || '',
                summary: rows[i][13] || ''
              };

              if (localJobFile) {
                fs.writeFileSync(localJobFile, JSON.stringify({ ...(localRecord || {}), ...remoteRecord }, null, 2), 'utf8');
              }
              return remoteRecord;
            }
          }
        }
      } catch (err) {}
    }

    return localRecord || { job_id: jobId, status: 'UNKNOWN', error: 'Job record not found' };
  }

  /**
   * Cancels an active or queued job
   */
  async cancelJob(jobId, sheetId = this.sheetId) {
    const job = await this.getJobStatus(jobId, sheetId);
    if (!job || job.status === 'UNKNOWN') {
      throw new Error(`Job ${jobId} not found`);
    }

    job.status = 'CANCELLED';
    job.completed_at = new Date().toISOString();
    job.summary = (job.summary || '') + ' [CANCELLED by user]';

    const localJobFile = path.join(JOBS_DIR, `${jobId}.json`);
    if (fs.existsSync(localJobFile)) {
      fs.writeFileSync(localJobFile, JSON.stringify(job, null, 2), 'utf8');
    }

    if (sheetId) {
      try {
        const rows = await this.client.getSheetValues('_Jobs_Queue!A:N', sheetId);
        if (rows && rows.length > 1) {
          for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === jobId) {
              await this.client.updateSheetValues(`_Jobs_Queue!D${i + 1}`, [['CANCELLED']], sheetId);
              break;
            }
          }
        }
      } catch (e) {}
    }

    return job;
  }

  /**
   * Resumes or retries a failed job
   */
  async resumeJob(jobId, sheetId = this.sheetId) {
    const job = await this.getJobStatus(jobId, sheetId);
    if (!job || job.status === 'UNKNOWN') {
      throw new Error(`Job ${jobId} not found`);
    }

    job.status = 'QUEUED';
    job.error = '';
    job.started_at = '';
    job.completed_at = '';

    const localJobFile = path.join(JOBS_DIR, `${jobId}.json`);
    fs.writeFileSync(localJobFile, JSON.stringify(job, null, 2), 'utf8');

    if (sheetId) {
      try {
        const rows = await this.client.getSheetValues('_Jobs_Queue!A:N', sheetId);
        if (rows && rows.length > 1) {
          for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === jobId) {
              await this.client.updateSheetValues(`_Jobs_Queue!D${i + 1}:K${i + 1}`, [['QUEUED', job.progress, job.total_items, job.completed_items, job.failed_items, job.pending_items, job.current_product, '']], sheetId);
              break;
            }
          }
        }
      } catch (e) {}
    }

    return job;
  }

  /**
   * Lists all known jobs
   */
  async listJobs(sheetId = this.sheetId) {
    const jobs = [];

    // 1. From remote sheet
    if (sheetId) {
      try {
        const rows = await this.client.getSheetValues('_Jobs_Queue!A:N', sheetId);
        if (rows && rows.length > 1) {
          for (let i = 1; i < rows.length; i++) {
            jobs.push({
              job_id: rows[i][0],
              task: rows[i][1],
              status: rows[i][3],
              created_at: rows[i][2],
              progress: rows[i][4] || '0%',
              completed: rows[i][6] || 0,
              failed: rows[i][7] || 0,
              total: rows[i][5] || 0,
              summary: rows[i][13] || ''
            });
          }
          return jobs;
        }
      } catch (e) {}
    }

    // 2. Fallback to local cache
    if (fs.existsSync(JOBS_DIR)) {
      const files = fs.readdirSync(JOBS_DIR).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const r = JSON.parse(fs.readFileSync(path.join(JOBS_DIR, file), 'utf8'));
          jobs.push({
            job_id: r.job_id,
            task: r.task,
            status: r.status,
            created_at: r.created_at,
            progress: r.progress,
            completed: r.completed_items,
            failed: r.failed_items,
            total: r.total_items,
            summary: r.summary
          });
        } catch (e) {}
      }
    }

    return jobs;
  }

  /**
   * Pushes products from local catalog into Google Sheet Product_Catalogue tab
   */
  async pushCatalogToSheet(sheetId = this.sheetId, options = {}) {
    if (!sheetId) throw new Error('Sheet ID is required to push catalogue');

    const limit = options.limit || 50;
    let products = [];
    const jsonPath = path.resolve(process.cwd(), 'public/grocery_catalog.json');
    if (fs.existsSync(jsonPath)) {
      products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }

    if (products.length === 0) {
      throw new Error('No local products found to export.');
    }

    const itemsToExport = products.slice(0, limit);
    const rows = itemsToExport.map(p => {
      const name = p.name || p.title || '';
      const brand = p.brand || '';
      const quantity = p.unit || p.quantity || p.pack || '1 unit';
      const mrp = p.mrp || p.price || 0;
      const imageUrl = p.image || p.image_url || '';
      const imageFile = imageUrl ? path.basename(imageUrl.split('?')[0]) : '';
      const status = imageUrl && !imageUrl.includes('placeholder') ? 'VERIFIED' : 'PENDING_GENERATION';

      return [name, brand, quantity, mrp, imageUrl, imageFile, status];
    });

    await this.client.appendSheetValues('Product_Catalogue!A:G', rows, sheetId);
    return { success: true, count: rows.length };
  }
}
