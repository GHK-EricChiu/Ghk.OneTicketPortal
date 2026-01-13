import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import * as CryptoJS from 'crypto-js';

import { HttpClient } from '@angular/common/http';




const SECRET_KEY = 'C7fX9pQ2LmZ4r8aN1vS6dW3tG0yHb5kE';

function base64UrlToUint8Array(b64url: string): Uint8Array {
  const pad = (s: string) => s + '==='.slice((s.length + 3) % 4);
  const b64 = pad(b64url.replace(/-/g, '+').replace(/_/g, '/'));
  const firstDecoded = atob(b64); // First base64 decode

  // Check if it's still base64-encoded — try decode again if needed
  const maybeSecondDecoded = (() => {
    try {
      return atob(firstDecoded);
    } catch {
      return firstDecoded;
    }
  })();

  const bytes = Uint8Array.from(maybeSecondDecoded, c => c.charCodeAt(0));
  return bytes;
}

function uint8ToWordArray(u8Array: Uint8Array): CryptoJS.lib.WordArray {
  const words = [];
  for (let i = 0; i < u8Array.length; i += 4) {
    words.push(
      (u8Array[i] << 24) |
      (u8Array[i + 1] << 16) |
      (u8Array[i + 2] << 8) |
      (u8Array[i + 3])
    );
  }

  return CryptoJS.lib.WordArray.create(words, u8Array.length);
}

export function decryptPayload(data: string): Record<string, unknown> {
  // bytes = IV (16) || ciphertext
  const all = base64UrlToUint8Array(data);
  const ivBytes = all.slice(0, 16);
  const ctBytes = all.slice(16);

  const ivWA = uint8ToWordArray(ivBytes);
  const ctWA = uint8ToWordArray(ctBytes);
  const keyWA = CryptoJS.enc.Utf8.parse(SECRET_KEY); // 32 bytes


  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: ctWA
  });

  const decrypted = CryptoJS.AES.decrypt(
    cipherParams,
    keyWA,
    { iv: ivWA, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );

  const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  if (!plaintext) throw new Error('Decryption failed (empty plaintext)');
  return JSON.parse(plaintext);
}

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="success-container">

      <section class="success-card"  *ngIf="isAccept">
        <div class="icon-circle">
          <svg viewBox="0 0 24 24" class="check">
            <path d="M20.285 6.709a1 1 0 0 0-1.57-1.246l-8.2 10.33-4.23-4.23a1 1 0 0 0-1.414 1.415l5 5a1 1 0 0 0 1.51-.065l8.904-11.204z"/>
          </svg>
        </div>

        <h2 class="title"  *ngIf="isAccept; else notAccept">Thanks for Payment<br>
          <span lang="zh" class="ghk-zh">付款成功</span></h2>
        <p class="subtitle" *ngIf="isAccept; else notAccept">
           Your payment has been successfully processed. Thank You.<br>
             <span lang="zh" class="ghk-zh">交易完成，謝謝。</span>
        </p>
        <ng-template #notAccept>
          <p class="subtitle">Payment status: {{ decision || 'Unknown' }}</p>
        </ng-template>

        <div class="ref-row" *ngIf="referenceNo">
          <span>Reference No.:</span>
          <span class="ref">{{ referenceNo }}</span>
        </div>

        <div class="amount-row" *ngIf="amount">
          <span>Amount:</span>
          <span class="amt">HKD {{ amount }}</span>
        </div>
<div class="btn-row" *ngIf="canInovicePrint">
  <button class="dl-btn" (click)="downloadInvoice()">
    Download Invoice(s)
    <span lang="zh" class="ghk-zh">下載收據</span>
  </button>
</div>
<div class="dl-error" *ngIf="downloadErrorEn || downloadErrorZh" aria-live="polite">
  <div>{{ downloadErrorEn }}</div>
  <div *ngIf="downloadErrorZh" lang="zh" class="ghk-zh">{{ downloadErrorZh }}</div>
</div>
      </section>
    </main>
  `,
  styles: [`
    :host { display:block; width:100%; }
.btn-row { margin-top: 12px; display:flex; justify-content:center; }
.dl-btn {
  border: 0; border-radius: 12px; padding: 10px 16px; cursor: pointer;
  background: var(--ghk-blue, #0066b3); color: #fff; font-weight: 600;
  box-shadow: 0 6px 16px rgba(0,102,179,.25); transition: transform .15s ease, box-shadow .15s ease;
}
.dl-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(0,102,179,.3); }
.dl-btn:active { transform: translateY(0); box-shadow: 0 4px 12px rgba(0,102,179,.25); }
.ghk-zh { display:block; font-size: 12px; opacity:.9; }
  /* Fill the AVAILABLE space in the shell-main, not the whole viewport */
  .success-container {
    min-height: 100%;
    width: 100%;
    display: grid;
    place-items: center;   /* vertical + horizontal center */
    padding: 16px;
    box-sizing: border-box;
  }


    .success-card {width: 100%;
      background:#fff; border-radius:16px; padding:24px; box-shadow:0 8px 24px rgba(15,23,42,.06);
      text-align:center;
    }
    .icon-circle {
      width:72px; height:72px; border-radius:999px;
      background:#e6f7ee; margin:0 auto 12px; display:grid; place-items:center;
      box-shadow: inset 0 0 0 2px #b7ebc6;
    }
    .check { width:36px; height:36px; fill:#19a75a; }
    .title { margin:4px 0 2px; font-size:20px; color:#0f172a; }
    .subtitle { margin:0 0 12px; color:#334155; font-size:14px; }
    .ref-row, .amount-row {
      display:flex; gap:6px; justify-content:center; flex-wrap:wrap;
      font-size:13px; color:#334155; margin:4px 0;
    }
    .ref { color:#0f172a; font-weight:600; word-break:break-all; }
    .amt { color:#0f172a; font-weight:600; }
.dl-error {
  margin-top: 8px;
  color: #b91c1c;   /* red-700 */
  font-size: 13px;
  text-align: center;
}
.dl-error [lang="zh"] { display:block; font-size:12px; opacity:.9; }
  `]
})

export class PaymentSuccessComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private http = inject(HttpClient);
  private apiUrl = '';
  decision = '';
  referenceNo = '';
  amount = '';
  now = new Date();
  canInovicePrint = false;
  downloadErrorEn = '';
  downloadErrorZh = '';
  autoDownload = false;
  invoiceNums: string[] = [];
  private autoDownloadTriggered = false;
  private dialogShown = false;
  get isAccept() { return this.decision?.toUpperCase() === 'ACCEPT'; }

  ngOnInit() {
    const qp = new URLSearchParams(window.location.search);
    const enc = qp.get('data');
    if (enc) {
      const payload = decryptPayload(enc);
      this.decision = String(payload['decision'] ?? '');
      this.referenceNo = String(payload['reference_number'] ?? '');
      this.amount = String(payload['amount'] ?? '');
      // initialize from payload but we'll prefer server-side check below
      this.canInovicePrint = (payload['canInvoicePrint'] ?? 'false') == 'true';
      this.autoDownload = this.parseBool(payload['autoDownload']);
      this.invoiceNums = this.parseInvoiceNums(payload['invoiceNums']);
    }
    fetch('assets/config.json')
      .then(r => r.json())
      .then(cfg => {
        this.apiUrl = cfg.apiUrl ?? '';
        this.tryAutoDownload();
      });
  }

  // After view init we can call server to get authoritative permission to print
  ngAfterContentInit() {
    // If we already know there's no reference or no apiUrl yet, wait a short bit
    // then attempt the server call. This keeps the change minimal; if the app
    // lifecycle ensures apiUrl is available earlier, the call will proceed.
    setTimeout(() => this.checkCanPrint(), 50);
    setTimeout(() => this.showDownloadDialogIfNeeded(), 0);
  }

  private checkCanPrint() {
    const list = this.invoiceNums.length ? [...this.invoiceNums] : (this.referenceNo ? [this.referenceNo] : []);
    if (!list.length || !this.apiUrl) return;
    this.checkCanPrintSequentially(list);
  }

  private async checkCanPrintSequentially(invoiceNums: string[]) {
    const valid: string[] = [];
    for (const invoiceNo of invoiceNums) {
      // eslint-disable-next-line no-await-in-loop
      const canPrint = await this.checkCanPrintByNumber(invoiceNo);
      if (canPrint) valid.push(invoiceNo);
    }

    // Keep only printable invoices
    this.invoiceNums = valid;
    this.canInovicePrint = valid.length > 0;
    this.tryAutoDownload();
  }

  private checkCanPrintByNumber(invoiceNo: string) {
    return new Promise<boolean>((resolve) => {
      if (!invoiceNo || !this.apiUrl) {
        resolve(false);
        return;
      }

      const url = `${this.apiUrl}/api/Ticket/CanPrintInvoice`;
      // Send invoice number as JSON body (string) to match backend expectations
      this.http.post<boolean>(url, JSON.stringify(invoiceNo), {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      }).subscribe({
        next: (res) => resolve(Boolean(res)),
        error: (_) => resolve(false)
      });
    });
  }

  private tryAutoDownload() {
    if (this.autoDownloadTriggered) return;
    if (!this.autoDownload) return;
    if (!this.canInovicePrint || !this.apiUrl) return;
    const list = this.invoiceNums.length ? this.invoiceNums : (this.referenceNo ? [this.referenceNo] : []);
    if (!list.length) return;
    this.autoDownloadTriggered = true;
    this.downloadInvoicesSequentially(list, 500);
  }

  private showDownloadDialogIfNeeded() {
    if (this.dialogShown) return;
    if (this.autoDownload) return;
    this.dialogShown = true;
    window.alert('Download Invoice first\n請先下載發票');
  }

  private parseBool(value: unknown) {
    if (value === true || value === false) return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
    return false;
  }

  private parseInvoiceNums(value: unknown) {
    if (typeof value !== 'string') return [];
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }

  private async downloadInvoicesSequentially(invoiceNums: string[], delayMs = 0) {
    for (let i = 0; i < invoiceNums.length; i += 1) {
      const invoiceNo = invoiceNums[i];
      // Sequential download to avoid overlapping blob responses.
      // eslint-disable-next-line no-await-in-loop
      await this.downloadInvoiceByNumber(invoiceNo);
      if (delayMs > 0 && i < invoiceNums.length - 1) {
        // eslint-disable-next-line no-await-in-loop
        await this.delay(delayMs);
      }
    }
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private downloadInvoiceByNumber(invoiceNo: string) {
    return new Promise<void>((resolve) => {
      if (!invoiceNo || !this.apiUrl) {
        resolve();
        return;
      }

      const url = `${this.apiUrl}/api/Ticket/GetInvoicePrintout`;
      this.http.post(url, JSON.stringify(invoiceNo), {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'blob',
        withCredentials: true,
        observe: 'response'
      }).subscribe({
        next: (res) => {
          this.downloadErrorEn = '';
          this.downloadErrorZh = '';

          const blob = res.body as Blob;
          const file = new Blob([blob], { type: 'application/octet-stream' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(file);
          link.download = `invoice-${invoiceNo.replace(/[^A-Za-z0-9._-]/g, '')}.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(link.href);
          resolve();
        },
        error: (err) => {
          if (err.status === 409) {
            this.downloadErrorEn = 'Download limit exceeded. Invoice already downloaded.';
            this.downloadErrorZh = '下載次數已達上限，該收據已下載。';
          } else {
            this.downloadErrorEn = 'Unable to download invoice. Please try again later.';
            this.downloadErrorZh = '無法下載收據，請稍後再試。';
          }
          resolve();
        }
      });
    });
  }

  downloadInvoice() {
    if (!this.apiUrl) return;
    const list = this.invoiceNums.length ? this.invoiceNums : (this.referenceNo ? [this.referenceNo] : []);
    if (!list.length) return;
    this.downloadInvoicesSequentially(list);
  }


  onCheckReceipt() {
    // If you have a receipt route or backend receipt URL, push to it here.
    // Example: /receipt?ref=...
    this.router.navigate(['/receipt'], { queryParams: { ref: this.referenceNo } });
  }

  onBack() {
    // Back to ticket/billing page (adjust route as needed)
    this.router.navigate(['/']);
  }
}
