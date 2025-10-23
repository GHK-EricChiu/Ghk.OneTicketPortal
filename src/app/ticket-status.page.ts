import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface TicketInfo {
  isSuccess: boolean;
  displayTicketNumber?: string;
  clinicNameEn?: string;
  clinicNameZh?: string;
  doctorNameEn?: string;
  doctorNameZh?: string;
  visitDate?: string;               // "yyyy-MM-dd HH:mm:ss"
  patientJourneyStatus?: string;    // e.g. "INVOICED", "COMPLETED", etc.
  statusMessageEn?: string;
  statusMessageZh?: string;
  canPayOnline?: boolean;
  amount?: string;
  summary?: BillingSummary;
}


interface BillingSummary {
  invoiceNum?: string;
  items?: BillingItem[];
}

interface BillingItem {
  type?: string;
  itemName?: string;
  totalCharge: number;
  billingItemTypeCode?: string | null;
}
interface PaymentInitResponse {
  paymentUrl: string;
  fields: Record<string, string>;
}

// Google Pay global namespace
declare const google: any;

interface GooglePayConfig {
  environment?: 'TEST' | 'PRODUCTION';
  merchantId?: string;
  merchantName?: string;
  gateway?: 'cybersource';
  gatewayMerchantId?: string;
  wcfServiceUrl?: string;
}

@Component({
  selector: 'app-ticket-status-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="ghk-main">
      <section class="ghk-ticket-status-card">

        <!-- Top info -->
          <div *ngIf="ticketInfo?.isSuccess" class="ghk-ticket-info-row">
      <div class="ghk-ticket-info-value">{{ ticketInfo?.displayTicketNumber }}</div>
    </div>

        <div *ngIf="ticketInfo?.isSuccess" class="ghk-ticket-info-pill-row">
            <div class="ghk-ticket-info-pill" *ngIf="ticketInfo?.clinicNameEn || ticketInfo?.clinicNameZh">
        <div>{{ ticketInfo?.clinicNameEn }}</div>
        <div *ngIf="ticketInfo?.clinicNameZh" lang="zh" class="ghk-zh-line">{{ ticketInfo?.clinicNameZh }}</div>
      </div>

      <!-- Keep Doctor EN/ZH as separate lines in one pill too (optional but consistent) -->
       <div *ngIf="ticketInfo?.isSuccess" class="ghk-ticket-info-pill-row">
        <div class="ghk-ticket-info-pill" *ngIf="ticketInfo?.doctorNameEn || ticketInfo?.doctorNameZh">
          <div>{{ ticketInfo?.doctorNameEn }}</div>
          <div *ngIf="ticketInfo?.doctorNameZh" lang="zh" class="ghk-zh-line">{{ ticketInfo?.doctorNameZh }}</div>
        </div>
      </div>

          <div class="ghk-ticket-info-pill-last" *ngIf="ticketInfo?.visitDate">
            {{ ticketInfo?.visitDate | date:'yyyy-MM-dd HH:mm' }}
          </div>

        </div>

        <div *ngIf="ticketInfo?.isSuccess" class="ghk-ticket-status-divider"></div>

        <!-- Status message from backend -->
        <div class="ghk-ticket-status-content">
          <p *ngIf="ticketInfo && !showPaymentOptions && ticketInfo?.canPayOnline != false" [innerHTML]="ticketMessageHtml"></p>

          <!-- Online payment only when INVOICED -->
          <div *ngIf="ticketInfo?.isSuccess && isInvoiced">
          <div
  *ngIf="ticketInfo?.canPayOnline === false && ticketInfo?.isSuccess && isInvoiced"
  class="ghk-alert ghk-alert-limit"
  role="alert"
  aria-live="polite"
>
  <div class="ghk-alert-title">
    <span>Amount Exceed</span><br>
    <span lang="zh" class="ghk-zh-line">金額超出限額</span>
  </div>

  <p class="ghk-alert-text">
    Your transaction amount exceeds the set limit. Please proceed to the Business Office cashier to settle your payment.<br>
    <span lang="zh" class="ghk-zh-line">您的交易金額已超出設定限額，請前往收費處繳費。</span>
  </p>
</div>
           <div class="ghk-terms-consent" *ngIf="!showPaymentOptions && ticketInfo?.canPayOnline">
              <input
                id="termsCheck"
                type="checkbox"
                [checked]="agreeTerms"
                (change)="agreeTerms = $any($event.target).checked"
                aria-describedby="termsDesc"
              />


              <div id="termsDesc" class="ghk-terms-desc">
                I have read and understood and agree to abide by the
                <a href="/terms"  class="ghk-terms-link">
                  terms and conditions
                </a>.<br>
                <span lang="zh" class="ghk-zh-line">
                  已閱讀並理解上述
                  <a href="/terms"   lang="zh" class="ghk-terms-link">
                    條款與條件
                  </a>，並同意遵守。
                </span>
              </div>
            </div>


            <button
              class="ghk-payment-btn"
              (click)="showPaymentOptions = true"
              *ngIf="!showPaymentOptions && ticketInfo?.canPayOnline"   [disabled]="!agreeTerms"
            >
              Online Payment 線上付款
            </button>

            <div *ngIf="showPaymentOptions || ticketInfo?.canPayOnline === false">
            <div class="ghk-btotal">
                <div>
                  <span>BALANCE DUE</span><br>
                  <span lang="zh" class="ghk-zh-line">應繳金額</span>
                </div>
                <div class="ghk-bamt">{{ balanceDue | number:'1.2-2' }}</div>
              </div>

                 <div class="ghk-payment-options"  *ngIf="ticketInfo?.canPayOnline">
                <div class="ghk-payment-icons" *ngIf="!gpayReady">
                  <button class="ghk-pay-icon-btn" (click)="onPay('visa')" title="Visa">
                    <img src="assets/payment/visa.svg" alt="Visa" />
                  </button>
                  <button class="ghk-pay-icon-btn" (click)="onPay('mastercard')" title="MasterCard">
                    <img src="assets/payment/mastercard.svg" alt="MasterCard" />
                  </button>
                  <button class="ghk-pay-icon-btn" (click)="onPay('cup')" title="CUP">
                    <img src="assets/payment/cup.svg" alt="CUP" />
                  </button>
                  <button class="ghk-pay-icon-btn" (click)="onPay('jcb')" title="JCB">
                    <img src="assets/payment/jcb.svg" alt="JCB" />
                  </button>
                  <button class="ghk-pay-icon-btn" (click)="onPay('amex')" title="AMEX">
                    <img src="assets/payment/amex.svg" alt="AMEX" />
                  </button>
<button class="ghk-pay-icon-btn" (click)="onPay('googlepay')" title="Google Pay">
                    <img src="assets/payment/googlepay.svg" alt="Google Pay" />
                  </button>
                  <!-- (Apple/Google Pay later via Simple Order API) -->
                  <!--  <img src="assets/payment/alipay.svg" alt="Alipay" title="Alipay" />-->
                  <!--  <img src="assets/payment/wechatpay.svg" alt="WeChat Pay" title="WeChat Pay" />-->
                  <!--  <img src="assets/payment/googlepay.svg" alt="Google Pay" title="Google Pay" />-->
                  <!--  <img src="assets/payment/applepay.svg" alt="Apple Pay" title="Apple Pay" />  -->
                </div>
                  <div class="ghk-ticket-status-divider"></div>
                  <!-- Google Pay official button is injected here when available -->
                  <div id="gpay-container"></div>
                </div>

              <div *ngIf="payError" class="ghk-pay-error">{{ payError }}</div>
           <div *ngIf="ticketInfo?.summary" class="ghk-billing-summary">

  <!-- Hospital Fee -->
  <div class="ghk-bgrp">
    <div class="ghk-btitle">
      <span>HOSPITAL FEE</span>
      <span lang="zh" class="ghk-zh-line">醫院收費</span>
    </div>

    <div class="ghk-brow" *ngFor="let it of hospitalItems">
      <div class="ghk-bname">{{ it.itemName }}</div>
      <div class="ghk-bamt">{{ it.totalCharge | number:'1.2-2' }}</div>
    </div>

    <div class="ghk-bsubtotal">
      <div>
        <span>Total Hospital Charges</span><br>
        <span lang="zh" class="ghk-zh-line">總醫院收費</span>
      </div>
      <div class="ghk-bamt">{{ hospitalTotal | number:'1.2-2' }}</div>
    </div>
  </div>

  <div class="ghk-ticket-status-divider"></div>

  <!-- Doctor Fee -->
  <div class="ghk-bgrp">
    <div class="ghk-btitle">
      <span>DOCTOR FEE</span>
      <span lang="zh" class="ghk-zh-line">醫生收費</span>
    </div>

    <div class="ghk-brow" *ngFor="let it of doctorItems">
      <div class="ghk-bname">{{ it.itemName }}</div>
      <div class="ghk-bamt">{{ it.totalCharge | number:'1.2-2' }}</div>
    </div>

    <div class="ghk-bsubtotal">
      <div>
        <span>Total Doctor Charges</span><br>
        <span lang="zh" class="ghk-zh-line">總醫生收費</span>
      </div>
      <div class="ghk-bamt">{{ doctorTotal | number:'1.2-2' }}</div>
    </div>
  </div>

  <div class="ghk-ticket-status-divider"></div>

  <!-- Less (Discount) -->
  <div class="ghk-bgrp" *ngIf="discountItems.length">
    <div class="ghk-btitle">
      <span>LESS</span>
      <span lang="zh" class="ghk-zh-line">扣減</span>
    </div>

    <div class="ghk-brow" *ngFor="let it of discountItems">
      <div class="ghk-bname">{{ it.itemName }}</div>
      <div class="ghk-bamt">{{ it.totalCharge | number:'1.2-2' }}</div>
    </div>

    <div class="ghk-bsubtotal">
      <div>
        <span>LESS</span><br>
        <span lang="zh" class="ghk-zh-line">扣減</span>
      </div>
      <div class="ghk-bamt">{{ discountTotal | number:'1.2-2' }}</div>
    </div>
  </div>

  <div class="ghk-ticket-status-divider"></div>

  <!-- Grand Total -->
  <div class="ghk-btotal">
    <div>
      <span>Grand Total</span><br>
      <span lang="zh" class="ghk-zh-line">總額</span>
    </div>
    <div class="ghk-bamt">{{ grandTotal | number:'1.2-2' }}</div>
  </div>

  <!-- Balance Due -->

</div>



            </div>
          </div>
        </div>
      </section>
    </main>
  `,
  styles: [`

    .ghk-billing-summary {
  margin: 1rem 0;
  font-size: 0.95rem;
  color: #111;
}
.ghk-alert {
  border-radius: 12px;
  padding: 12px 14px;
  margin: 10px 0 14px;
}
.ghk-alert-limit {
  background: #fff7ed;             /* soft amber */
  border: 1px solid #fdba74;       /* amber-300 */
  box-shadow: 0 4px 10px rgba(253, 186, 116, 0.25);
}
.ghk-alert-title {
  font-weight: 700;
  color: #9a3412;                  /* amber-800 */
  margin-bottom: 6px;
}
.ghk-alert-text { margin: 0; color: #7c2d12; }
.ghk-bgrp {
  margin-bottom: 1rem;
}

.ghk-btitle {
  font-weight: 600;
  color: var(--ghk-blue, #0066b3);
  display: flex;
  flex-direction: column;
  margin-bottom: 0.4rem;
}

.ghk-brow,
.ghk-bsubtotal,
.ghk-btotal {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
}

.ghk-brow .ghk-bname {
  flex: 1;
}

.ghk-bamt {
  min-width: 100px;
  text-align: right;
}

.ghk-bsubtotal {
  font-weight: 600;
  margin-top: 0.4rem;
  border-top: 1px dashed #ccc;
  padding-top: 0.3rem;
}

.ghk-btotal {
  font-weight: 700;
  font-size: 1rem;
  margin-top: 0.6rem;
}

.ghk-zh-line {
  font-size: 0.85rem;
  opacity: 0.85;
}
.ghk-payment-btn[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}
.ghk-terms-label { line-height: 1.2; }

.ghk-terms-link { color: var(--ghk-blue, #0066b3); text-decoration: underline; }
.ghk-terms-link:focus { outline: 2px solid #93c5fd; outline-offset: 2px; }
.ghk-terms-consent {
  display: grid;
  grid-template-columns: 26px auto; /* match bigger box */
  gap: 8px 10px;
  align-items: start;
  margin: 10px 0 14px 0;
  font-size: 0.95rem;
  color: #334155;
}
  .ghk-terms-consent input[type="checkbox"] {
  width: 22px;       /* bigger box */
  height: 22px;
  transform: scale(1); /* enlarge the native checkbox */
  margin-top: 2px;
  cursor: pointer;
}
.ghk-terms-consent input { margin-top: 2px; }
    .ghk-ticket-number-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 6px;
  margin-bottom: 10px;
}

.ghk-zh-line {
  font-size: 0.86rem;
  opacity: 0.9;
  font-family: var(--font-cjk);
}
    .ghk-payment-btn {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--ghk-blue, #0066b3); color: var(--ghk-white, #fff);
      font-size: 1rem; font-weight: 600; letter-spacing: 0.5px;
      padding: 0.9rem 1.8rem; border: none; border-radius: 12px; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 102, 179, 0.25);
      transition: all 0.2s ease-in-out;
    }
    .ghk-payment-btn:hover { background: #00539b; box-shadow: 0 6px 16px rgba(0, 83, 155, 0.3); transform: translateY(-2px); }
    .ghk-payment-btn:active { background: #004080; transform: translateY(0); box-shadow: 0 2px 6px rgba(0, 64, 128, 0.25); }
    .ghk-payment-icons { display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:1rem; justify-content:center; }
    .ghk-payment-icons img { height:24px; width:auto; }
    .ghk-pay-icon-btn { background: transparent; border: 0; padding: 0; cursor: pointer; }
    .ghk-pay-icon-btn img { height: 28px; }
    .ghk-pay-error { color:#c00; margin-top:8px; }
  `]
})
export class TicketStatusPage implements OnInit {
  ticketInfo: TicketInfo | null = null;
  showPaymentOptions = false;
  payError = '';
  agreeTerms = false;
  private apiUrl = '';
  ticketId: String | null = '';
  // Google Pay state
  private gpayClient: any | null = null;
  gpayReady = false;
  private wcfServiceUrl: string | null = null;
  private gpayConfig: GooglePayConfig = {
    environment: 'TEST',
    merchantId: undefined,
    merchantName: 'Gleneagles Hospital Hong Kong',
    gateway: 'cybersource',
    gatewayMerchantId: 'gphk088031858218'
  };
  get isInvoiced(): boolean {
    return (this.ticketInfo?.patientJourneyStatus?.toUpperCase() === 'INVOICED');
  }
  get _items(): BillingItem[] { return this.ticketInfo?.summary?.items ?? []; }
  get hospitalItems(): BillingItem[] { return this._items.filter(i => (i.type ?? '').toUpperCase() === 'HF'); }
  get doctorItems(): BillingItem[] { return this._items.filter(i => (i.type ?? '').toUpperCase() === 'DF'); }
  get discountItems(): BillingItem[] { return this._items.filter(i => (i.type ?? '').toUpperCase() === 'DC'); }

  get hospitalTotal(): number { return this.hospitalItems.reduce((s, i) => s + (i.totalCharge || 0), 0); }
  get doctorTotal(): number { return this.doctorItems.reduce((s, i) => s + (i.totalCharge || 0), 0); }
  get discountTotal(): number { return this.discountItems.reduce((s, i) => s + (i.totalCharge || 0), 0); } // likely negative

  get grandTotal(): number { return this.hospitalTotal + this.doctorTotal + this.discountTotal; }
  get balanceDue(): number { return this.ticketInfo?.amount ? parseFloat(this.ticketInfo.amount) : 0; }
  get ticketMessageHtml(): string {
    if (!this.ticketInfo) return '';
    const en = this.ticketInfo.statusMessageEn ?? '';
    const zh = this.ticketInfo.statusMessageZh ? `<br><span  lang="zh" class="ghk-zh-line" >${this.ticketInfo.statusMessageZh}</span>` : '';
    return `${en}${zh}`;
  }

  constructor(
    private http: HttpClient,
    private cd: ChangeDetectorRef,
    private zone: NgZone
  ) { }

  ngOnInit() {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    this.ticketId = params.get('data');

    this.http.get<any>('assets/config.json').subscribe(cfg => {
      this.apiUrl = cfg.apiUrl;
      if (this.apiUrl) {
        this.http.get<GooglePayConfig>(`${this.apiUrl}/api/Ticket/GooglePayConfig`).subscribe({
          next: gp => {
            this.gpayConfig.environment = (gp.environment || this.gpayConfig.environment) as any;
            this.gpayConfig.merchantId = gp.merchantId || this.gpayConfig.merchantId;
            this.gpayConfig.merchantName = gp.merchantName || this.gpayConfig.merchantName;
            this.gpayConfig.gateway = (gp.gateway as any) || this.gpayConfig.gateway;
            this.gpayConfig.gatewayMerchantId = gp.gatewayMerchantId || this.gpayConfig.gatewayMerchantId;
            this.wcfServiceUrl = gp.wcfServiceUrl || this.wcfServiceUrl;
          },
          error: _ => { /* keep defaults */ }
        });
      }

      if (this.ticketId && this.apiUrl) {
        this.http.get<TicketInfo>(`${this.apiUrl}/api/Ticket/GetTicketInfo/${this.ticketId}`).subscribe({
          next: info => {
            this.zone.run(() => {
              this.ticketInfo = info;
              this.cd.markForCheck();
            });
          },
          error: _ => {
            this.ticketInfo = {
              isSuccess: false,
              statusMessageEn: 'We’re currently experiencing a temporary service disruption. Our team is working to resolve the issue as quickly as possible. Thank you for your patience.',
              statusMessageZh: '我們目前正在處理系統問題，服務將儘快恢復，感謝您的耐心等候。'
            };
            this.cd.markForCheck();
          }
        });
      } else {
        this.ticketInfo = {
          isSuccess: false,
          statusMessageEn: 'Invalid QR code',
          statusMessageZh: '二維碼無效'
        };
        this.cd.markForCheck();
      }
    });
  }

  onPay(method: 'visa' | 'mastercard' | 'cup' | 'jcb' | 'amex' | 'card' | 'googlepay') {
    this.payError = '';
    if (!this.ticketInfo?.isSuccess || !this.apiUrl || !this.ticketInfo.displayTicketNumber) {
      this.payError = 'Payment is not available right now.';
      return;
    }

    if (method === 'googlepay') {
      this.startGooglePay();
      return;
    }

    const body = {
      ticketNumber: this.ticketId,
      method
    };

    this.http.post<PaymentInitResponse>(`${this.apiUrl}/api/Ticket/InitiatePayment`, body, { withCredentials: true })
      .subscribe({
        next: res => this.submitToGateway(res),
        error: _ => this.payError = 'Unable to initiate payment. Please try again.'
      });
  }

  private submitToGateway(res: PaymentInitResponse) {
    if (!res?.paymentUrl || !res?.fields) {
      this.payError = 'Payment setup incomplete.';
      return;
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = res.paymentUrl;

    for (const [k, v] of Object.entries(res.fields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = String(v ?? '');
      form.appendChild(input);
    }

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.style.display = 'none';
    form.appendChild(submit);

    document.body.appendChild(form);
    submit.click();
  }

  // --- Google Pay (pay.js) integration ---
  private async startGooglePay() {
    try {
      const ok = await this.waitForPayJs();
      if (!ok) {
        this.payError = 'Google Pay script not available. Please try again.';
        return;
      }

      if (!this.gpayClient) {
        this.gpayClient = new google.payments.api.PaymentsClient({
          environment: this.gpayConfig.environment || 'TEST'
        });
      }

      const isReadyReq = {
        apiVersion: 2,
        apiVersionMinor: 0,
        // Use base card method (no tokenization) for readiness check
        allowedPaymentMethods: [this.getGoogleBaseCardMethod()]
      };

      this.gpayClient.isReadyToPay(isReadyReq).then((res: any) => {
        if (res?.result) {
          this.renderGooglePayButton();
        } else {
          this.payError = 'Google Pay is not available on this device.';
        }
      }).catch((_err: any) => {
        this.payError = 'Unable to initialize Google Pay.';
      });
    } catch {
      this.payError = 'Google Pay initialization error.';
    }
  }

  private waitForPayJs(maxMs = 3000): Promise<boolean> {
    const start = Date.now();
    return new Promise(resolve => {
      const tick = () => {
        const ready = (window as any).google && google.payments && google.payments.api;
        if (ready) return resolve(true);
        if (Date.now() - start > maxMs) return resolve(false);
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  private renderGooglePayButton() {
    if (!this.gpayClient) return;
    const container = document.getElementById('gpay-root') || document.getElementById('gpay-container');
    if (!container) return;

    if (!this.gpayReady) {
      const btn = this.gpayClient.createButton({ onClick: () => this.loadGooglePaymentData() });
      container.innerHTML = '';
      container.appendChild(btn);
      this.gpayReady = true;
      this.cd.markForCheck();
      // optional: scroll into view to make the change visible
      try { btn.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { }
    }
  }

  private getGoogleBaseCardMethod() {
    return {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        allowedCardNetworks: ['AMEX', 'MASTERCARD', 'VISA', 'JCB']
      }
    };
  }

  private getTokenizationSpec() {
    return {
      type: 'PAYMENT_GATEWAY',
      parameters: {
        gateway: this.gpayConfig.gateway || 'cybersource',
        gatewayMerchantId: this.gpayConfig.gatewayMerchantId || ''
      }
    };
  }

  private getGoogleCardPaymentMethod() {
    const method = this.getGoogleBaseCardMethod();
    return { ...method, tokenizationSpecification: this.getTokenizationSpec() };
  }

  private getPaymentDataRequest() {
    const amount = Math.max(0, (this.balanceDue) || 0).toFixed(2);
    const req: any = {
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [this.getGoogleCardPaymentMethod()],
      transactionInfo: {
        totalPriceStatus: 'FINAL',
        totalPrice: amount,
        currencyCode: 'HKD'
      },
      merchantInfo: {
        merchantName: this.gpayConfig.merchantName || 'Merchant',
        ...(this.gpayConfig.merchantId ? { merchantId: this.gpayConfig.merchantId } : {})
      }
    };
    return req;
  }

  private loadGooglePaymentData() {
    if (!this.gpayClient) return;
    const request = this.getPaymentDataRequest();
    this.gpayClient.loadPaymentData(request)
      .then((paymentData: any) => this.onGooglePaymentAuthorized(paymentData))
      .catch((_err: any) => {
        this.payError = 'Google Pay was cancelled or failed.';
      });
  }

  private async onGooglePaymentAuthorized(paymentData: any) {
    try {
      const tokenJson = paymentData?.paymentMethodData?.tokenizationData?.token;
      if (!tokenJson) {
        this.payError = 'No Google Pay token received.';
        return;
      }

      // Post to backend API; TicketController will call WCF when method is googlepay
      const url = `${this.apiUrl}/api/Ticket/InitiatePayment`;
      const body = {
        ticketNumber: this.ticketId,
        method: 'googlepay',
        googlePayToken: window.btoa(tokenJson),
        googlePayTransactionId: paymentData?.googleTransactionId || undefined
      } as any;

      this.http.post<any>(url, body, { withCredentials: true }).subscribe({
        next: (res) => {
          const redirect = res?.redirectUrl;
          if (redirect) {
            window.location.href = redirect;
            return;
          }
          this.payError = 'Payment processed but no redirect provided.';
        },
        error: (err) => {
          const redirect = err?.error?.redirectUrl;
          if (redirect) {
            window.location.href = redirect;
            return;
          }
          this.payError = 'Failed to submit Google Pay token. Please try again.';
        }
      });
    } catch {
      this.payError = 'Error processing Google Pay token.';
    }
  }

  // Base64 helper no longer used for Google Pay tokens; keep if needed elsewhere
  // private toBase64(str: string): string {
  //   try { return btoa(unescape(encodeURIComponent(str))); } catch { return btoa(str); }
  // }

  private async callWcfGooglePayAuthorize(token: string, googleTxId?: string): Promise<{ success: boolean; decision?: string; reasonCode?: string; requestId?: string; }> {
    const amount = Math.max(0, (this.balanceDue) || 0).toFixed(2);
    const currency = 'HKD';
    const orderNumber = String(this.ticketId || this.ticketInfo?.displayTicketNumber || '');
    const svcUrl: string = this.wcfServiceUrl || `${window.location.origin}/GHK.OneTicketPortal.WcfService/GooglePayService.svc`;
    const soapAction = 'http://tempuri.org/IGooglePayService/Authorize';

    const soap = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <Authorize xmlns="http://tempuri.org/">
      <request xmlns:d4p1="http://schemas.datacontract.org/2004/07/GHK.OneTicketPortal.WcfService.Models" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
        <d4p1:Amount>${amount}</d4p1:Amount>
        <d4p1:Currency>${currency}</d4p1:Currency>
        <d4p1:GooglePayToken><![CDATA[${window.btoa(token)}]]></d4p1:GooglePayToken>
        <d4p1:GooglePayTransactionId>${googleTxId || ''}</d4p1:GooglePayTransactionId>
        <d4p1:OrderNumber>${orderNumber}</d4p1:OrderNumber>
      </request>
    </Authorize>
  </s:Body>
 </s:Envelope>`;

    try {
      const res = await fetch(svcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': soapAction
        },
        body: soap,
        credentials: 'include'
      });

      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');
      const pick = (name: string) => {
        const nodes = Array.from(doc.getElementsByTagName('*')) as Element[];
        const el = nodes.find(n => n.localName === name);
        return el?.textContent || '';
      };
      const success = pick('Success').toLowerCase() === 'true';
      const decision = pick('Decision');
      const reasonCode = pick('ReasonCode');
      const requestId = pick('RequestId');
      return { success, decision, reasonCode, requestId };
    } catch {
      return { success: false };
    }
  }
}
