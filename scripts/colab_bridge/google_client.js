// scripts/colab_bridge/google_client.js
/**
 * ====================================================================
 * BHUSAWAL CONNECT — GOOGLE SHEETS & DRIVE API CLIENT
 * ====================================================================
 * Connects to Google Sheets API v4 & Google Drive API v3 using
 * environment-injected GOOGLE_API_KEY or Service Account credentials.
 * Zero hardcoded keys.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Load .env if not already loaded into process.env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

// Standard 7 Catalogue Fields
export const REQUIRED_CATALOGUE_HEADERS = [
  'Product Name',
  'Brand',
  'Quantity',
  'MRP',
  'Image URL',
  'Image File',
  'Image Verification Status'
];

export const ALLOWED_VERIFICATION_STATUSES = [
  'VERIFIED',
  'PENDING_GENERATION',
  'REJECTED'
];

// Standard 14 Job Queue Fields
export const JOB_QUEUE_HEADERS = [
  'Job ID',
  'Task',
  'Created At',
  'Status',
  'Progress',
  'Total Items',
  'Completed Items',
  'Failed Items',
  'Pending Items',
  'Current Product',
  'Error',
  'Started At',
  'Completed At',
  'Summary'
];

export const ALLOWED_JOB_STATUSES = [
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
];

export const ALLOWED_TASKS = [
  'GENERATE_PRODUCT_IMAGES',
  'VERIFY_PRODUCT_IMAGES',
  'UPDATE_CATALOG',
  'PROCESS_CATALOG',
  'SYNC_RESULTS'
];

export const JOB_LOG_HEADERS = [
  'Timestamp',
  'Job ID',
  'Level',
  'Item / SKU',
  'Message'
];

export class GoogleApiClient {
  constructor(config = {}) {
    loadEnv();
    this.apiKey = config.apiKey || process.env.GOOGLE_API_KEY || '';
    this.sheetId = config.sheetId || process.env.GOOGLE_SHEET_ID || '';
    this.driveFolderId = config.driveFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || '';
    this.serviceAccountPath = config.serviceAccountPath || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || '';
    this.accessToken = config.accessToken || null;
    this.tokenExpiry = 0;
  }

  /**
   * Helper for fetch requests with exponential backoff
   */
  async _request(url, options = {}, retries = 3) {
    let lastError = null;
    let delay = 1000;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, options);

        if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const errMsg = data?.error?.message || `HTTP ${res.status} ${res.statusText}`;
          const err = new Error(`Google API Error (${res.status}): ${errMsg}`);
          err.status = res.status;
          throw err;
        }

        return data;
      } catch (err) {
        lastError = err;
        // Do not retry 4xx client errors (400, 401, 403, 404)
        if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
          break;
        }
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
        }
      }
    }
    throw lastError;
  }

  /**
   * Generates or retrieves an OAuth2 access token if a Service Account JSON exists
   */
  async getAuthHeaders() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return { 'Authorization': `Bearer ${this.accessToken}` };
    }

    if (this.serviceAccountPath && fs.existsSync(this.serviceAccountPath)) {
      try {
        const sa = JSON.parse(fs.readFileSync(this.serviceAccountPath, 'utf8'));
        const now = Math.floor(Date.now() / 1000);
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
        const claim = Buffer.from(JSON.stringify({
          iss: sa.client_email,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
          aud: 'https://oauth2.googleapis.com/token',
          exp: now + 3600,
          iat: now
        })).toString('base64url');

        const signer = crypto.createSign('RSA-SHA256');
        signer.update(`${header}.${claim}`);
        const signature = signer.sign(sa.private_key, 'base64url');
        const jwt = `${header}.${claim}.${signature}`;

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
        });

        const tokenData = await tokenRes.json();
        if (tokenData.access_token) {
          this.accessToken = tokenData.access_token;
          this.tokenExpiry = Date.now() + ((tokenData.expires_in || 3600) - 300) * 1000;
          return { 'Authorization': `Bearer ${this.accessToken}` };
        }
      } catch (err) {
        // Fall back to API Key
      }
    }

    return {};
  }

  /**
   * Appends key parameter or returns query string
   */
  _buildUrl(baseUrl, params = {}) {
    const url = new URL(baseUrl);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, v);
      }
    }
    if (this.apiKey && !url.searchParams.has('key') && !this.accessToken) {
      url.searchParams.set('key', this.apiKey);
    }
    return url.toString();
  }

  // ==================================================================
  // GOOGLE SHEETS API METHODS
  // ==================================================================

  /**
   * Fetches metadata for a spreadsheet
   */
  async getSpreadsheet(sheetId = this.sheetId) {
    if (!sheetId) throw new Error('Sheet ID is required (set GOOGLE_SHEET_ID in .env or pass sheetId)');
    const headers = await this.getAuthHeaders();
    const url = this._buildUrl(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`);
    return this._request(url, { method: 'GET', headers });
  }

  /**
   * Reads values from a specified range
   */
  async getSheetValues(range, sheetId = this.sheetId) {
    if (!sheetId) throw new Error('Sheet ID is required');
    const headers = await this.getAuthHeaders();
    const encodedRange = encodeURIComponent(range);
    const url = this._buildUrl(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}`, {
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    });
    const data = await this._request(url, { method: 'GET', headers });
    return data.values || [];
  }

  /**
   * Updates values in a specified range
   */
  async updateSheetValues(range, values, sheetId = this.sheetId) {
    if (!sheetId) throw new Error('Sheet ID is required');
    const headers = {
      'Content-Type': 'application/json',
      ...(await this.getAuthHeaders())
    };
    const encodedRange = encodeURIComponent(range);
    const url = this._buildUrl(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}`, {
      valueInputOption: 'USER_ENTERED'
    });
    return this._request(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ range, values })
    });
  }

  /**
   * Appends values to a specified sheet/tab
   */
  async appendSheetValues(range, values, sheetId = this.sheetId) {
    if (!sheetId) throw new Error('Sheet ID is required');
    const headers = {
      'Content-Type': 'application/json',
      ...(await this.getAuthHeaders())
    };
    const encodedRange = encodeURIComponent(range);
    const url = this._buildUrl(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}:append`, {
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS'
    });
    return this._request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ range, values })
    });
  }

  /**
   * Performs batch update requests (adding tabs, styling, formatting)
   */
  async batchUpdateSpreadsheet(requests, sheetId = this.sheetId) {
    if (!sheetId) throw new Error('Sheet ID is required');
    const headers = {
      'Content-Type': 'application/json',
      ...(await this.getAuthHeaders())
    };
    const url = this._buildUrl(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`);
    return this._request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests })
    });
  }

  // ==================================================================
  // GOOGLE DRIVE API METHODS
  // ==================================================================

  /**
   * Lists files in Google Drive folder
   */
  async listDriveFiles(folderId = this.driveFolderId, pageSize = 100) {
    const headers = await this.getAuthHeaders();
    let query = "trashed = false";
    if (folderId) {
      query += ` and '${folderId}' in parents`;
    }
    const url = this._buildUrl('https://www.googleapis.com/drive/v3/files', {
      q: query,
      pageSize,
      fields: 'files(id, name, mimeType, webViewLink, webContentLink, size, createdTime)'
    });
    return this._request(url, { method: 'GET', headers });
  }

  /**
   * Gets direct public/viewable download URL for a file ID
   */
  static getDirectDriveImageUrl(fileId) {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
}
