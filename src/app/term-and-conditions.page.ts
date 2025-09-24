// src/app/pages/terms/terms.page.ts
import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
interface AppCfg { apiUrl: string }
interface TermsResponse {
  version: string;
  lang: string;
  title: string;
  content: string;
}

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="terms-wrap">

      <div class="terms-card" *ngIf="loaded; else loadingOrError">
        <h1 class="terms-title">{{termsEn?.title}}<br> <span lang="zh" class="terms-title">{{termsZh?.title}}</span></h1>
        <p class="terms-meta" *ngIf="version">Version: {{ version }}</p>

        <div class="terms-grid">
          <article class="terms-block">

            <pre class="terms-content">{{ termsEn?.content }}</pre>
          </article>
          <article class="terms-block">
            <pre lang="zh" class="terms-content">{{ termsZh?.content }}</pre>
          </article>

        </div>
        <div class="terms-actions" *ngIf="canGoBack">
          <button   class="ghk-btn-back" (click)="onBack()">
  Back <br>
  <span lang="zh">返回</span>
</button>
</div>
      </div>


      <ng-template #loadingOrError>
        <div class="terms-card">
          <h1 class="terms-title">Payment Terms <span class="zh">/ 付款條款</span></h1>
          <p class="terms-meta" *ngIf="!hadError">Loading…</p>
          <div class="terms-error" *ngIf="hadError">
            <p>We’re currently experiencing a temporary service disruption. Thank you for your patience.</p>
            <p>我們目前正在處理系統問題，服務將儘快恢復，感謝您的耐心等候。</p>
          </div>
        </div>
      </ng-template>
    </section>
  `,
  styles: [`
    :host { display:block; width:100%; height:100%; }

    /* Page container sits inside .shell-main and can scroll */
    .terms-wrap {
      width: 100%;
      max-width: 1080px;
      margin: 0 auto;
      padding: 12px;            /* small mobile padding */
      box-sizing: border-box;
    }
.terms-actions {
  display: flex;
  justify-content: center;   /* centers the button horizontally */
  margin-top: 12px;
}
    .terms-card {
      width: 100%;
      background:#fff;
      border-radius:16px;
      padding: 16px;            /* smaller padding for mobile */
      box-shadow:0 4px 14px rgba(15,23,42,.06);
      box-sizing: border-box;
    }
    @media (min-width: 640px) { .terms-card { padding: 20px; } }
    @media (min-width: 1024px) { .terms-card { padding: 24px; } }

    .terms-title {
      margin: 0 0 6px;
      font-size: 18px; font-weight: 800; color:#0f172a;
      text-align: center;
    }
    .terms-title .zh { font-weight: 700; }
    @media (min-width: 640px) { .terms-title { font-size: 20px; } }
    @media (min-width: 1024px) { .terms-title { font-size: 22px; } }

    .terms-meta {
      margin: 0 0 12px;
      color:#475569; font-size:12px; text-align:center;
    }

    .terms-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;                /* tighter gap for mobile */
    }
    @media (min-width: 900px) {
      .terms-grid { grid-template-columns: 1fr 1fr; gap: 16px; }
    }

    .terms-block {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 12px;
      background: #fafafa;
    }
    @media (min-width: 640px) { .terms-block { padding: 14px; } }

    .terms-lang {
      margin: 0 0 6px;
      font-size: 15px; font-weight: 700; color:#0f172a;
    }
    @media (min-width: 640px) { .terms-lang { font-size: 16px; } }

    .terms-content {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.5;
      font-family: inherit;
      font-size: 14px;
      color: #334155;
    }

    .ghk-btn-back {
   display: inline-flex; align-items: center; justify-content: center;
      background: var(--ghk-blue, #0066b3); color: var(--ghk-white, #fff);
      font-size: 1rem; font-weight: 600; letter-spacing: 0.5px;
      padding: 0.9rem 1.8rem; border: none; border-radius: 12px; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 102, 179, 0.25);
      transition: all 0.2s ease-in-out;
}

.ghk-btn-back:hover {
  text-decoration: underline;
}

    @media (max-width: 360px) { .terms-content { font-size: 13px; } }

    .terms-error {
      background: #fff4f4;
      border: 1px solid #ffd9d9;
      padding: 12px;
      border-radius: 10px;
      color: #7f1d1d;
      font-size: 14px;
    }

  `]
})
export class TermsPage implements OnInit {
  apiUrl = '';
  version: string | null = null;

  termsEn: TermsResponse | null = null;
  termsZh: TermsResponse | null = null;
canGoBack = false;
  loaded = false;
  hadError = false;

  constructor(
    private http: HttpClient,
    private zone: NgZone,
    private cd: ChangeDetectorRef,  private location: Location
  ) {}

  onBack() {
  this.location.back();   // goes to previous page in browser history
}
  ngOnInit(): void {
    this.canGoBack = window.history.length > 1;
    this.http.get<AppCfg>('assets/config.json').subscribe(cfg => {
      this.apiUrl = cfg.apiUrl || '';
      if (!this.apiUrl) return this.fail();

      // Fire both calls; render when both arrive
      this.http.get<TermsResponse>(`${this.apiUrl}/api/Ticket/Terms?lang=en`).subscribe({
        next: res => this.setEn(res), error: _ => this.fail()
      });

      this.http.get<TermsResponse>(`${this.apiUrl}/api/Ticket/Terms?lang=zh`).subscribe({
        next: res => this.setZh(res), error: _ => this.fail()
      });
    }, _ => this.fail());
  }

  private setEn(res: TermsResponse) {
    this.zone.run(() => {
      this.termsEn = res;
   //   this.version ??= res.version;
      this.checkLoaded();
    });
  }
  private setZh(res: TermsResponse) {
    this.zone.run(() => {
      this.termsZh = res;
   //   this.version ??= res.version;
      this.checkLoaded();
    });
  }
  private checkLoaded() {
    if (this.termsEn && this.termsZh) {
      this.loaded = true; this.hadError = false; this.cd.markForCheck();
    }
  }
  private fail() {
    this.zone.run(() => { this.loaded = false; this.hadError = true; this.cd.markForCheck(); });
  }
}
