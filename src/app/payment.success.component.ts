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
<div class="btn-row" *ngIf="referenceNo">
  <button class="dl-btn" (click)="downloadInvoice()">
    Download Invoice
    <span lang="zh" class="ghk-zh">下載收據</span>
  </button>
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

  get isAccept() { return this.decision?.toUpperCase() === 'ACCEPT'; }

  ngOnInit() {
     const qp = new URLSearchParams(window.location.search);
    const enc = qp.get('data');
    if (enc) {
      const payload = decryptPayload(enc);
      this.decision = String(payload['decision'] ?? '');
      this.referenceNo = String(payload['reference_number'] ?? '');
      this.amount = String(payload['amount'] ?? '');
    }
      fetch('assets/config.json')
    .then(r => r.json())
    .then(cfg => { this.apiUrl = cfg.apiUrl ?? ''; });
  }
downloadInvoice() {
  if (!this.referenceNo || !this.apiUrl) return;


  const url = `${this.apiUrl}/api/Ticket/GetInvoicePrintout`;
  this.http.post(url, JSON.stringify(this.referenceNo), {
    headers: { 'Content-Type': 'application/json' },
    responseType: 'blob'
  }).subscribe({
    next: (blob) => {
      const file = new Blob([blob], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = `invoice-${this.referenceNo.replace(/[^A-Za-z0-9._-]/g,'')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    }
  });
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
