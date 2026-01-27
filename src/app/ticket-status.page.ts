import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
  summary?: MultiBillingSummary[];
}


interface MultiBillingSummary {
  invoiceNum?: string;
  clinicName?: string;
  items?: MultiBillingItem[];
}

interface MultiBillingItem {
  type?: string;
  date?: string;
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
declare const ApplePaySession: any;

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
          <p *ngIf="ticketInfo && !showPaymentOptions && ticketInfo.canPayOnline != false" [innerHTML]="ticketMessageHtml"></p>

          <!-- Online payment only when READY_TO_PAYMENT / INVOICED -->
          <div *ngIf="ticketInfo?.isSuccess && isReadyToPay">
          <div
  *ngIf="ticketInfo?.canPayOnline === false && ticketInfo?.isSuccess && isReadyToPay"
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
              (click)="openPaymentOptions()"
              *ngIf="!showPaymentOptions && ticketInfo?.canPayOnline"   [disabled]="!agreeTerms || payLoading"
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
                <div class="ghk-payment-icons">
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
                  <button  class="apple-pay-button" (click)="onPay('applepay')" title="Apple Pay" *ngIf="showApplePay">
                
                  </button>
                  <!-- Google Pay official button is injected here when available -->
                  <div id="gpay-container"></div>
                  
                  <button class="ghk-pay-icon-btn" (click)="onPay('alipay')" title="Alipay">
                    <img src="assets/payment/alipay.svg" alt="Alipay" />
                  </button>
                  <button class="ghk-pay-icon-btn" (click)="onPay('wechatpay')" title="WeChat Pay">
                    <img src="assets/payment/wechatpay.svg" alt="WeChat Pay" />
                  </button>
                  <!-- (Apple/Google Pay later via Simple Order API) -->
                      
                  <!--  <img src="assets/payment/alipay.svg" alt="Alipay" title="Alipay" />-->
                  <!--  <img src="assets/payment/wechatpay.svg" alt="WeChat Pay" title="WeChat Pay" />-->
                  <!--  <img src="assets/payment/googlepay.svg" alt="Google Pay" title="Google Pay" />-->
                  <!--  <img src="assets/payment/applepay.svg" alt="Apple Pay" title="Apple Pay" />  -->
                </div>
                  <div class="ghk-ticket-status-divider"></div>
                </div>

              <div *ngIf="payLoading" class="ghk-busy-overlay" role="status" aria-live="polite">
                <div class="ghk-busy-panel">
                  <span class="ghk-spinner" aria-hidden="true"></span>
                  <span class="ghk-busy-text">Processing payment...</span>
                </div>
              </div>
              <div *ngIf="payError" class="ghk-pay-error">{{ payError }}</div>
           <div *ngIf="ticketInfo?.summary?.length" class="ghk-multi-billing">
             <div class="ghk-multi-card" *ngFor="let s of ticketInfo?.summary; let i = index">
               <button class="ghk-multi-header" type="button" (click)="toggleSummary(i)">
                 <div class="ghk-multi-title">
                   <div class="ghk-multi-invoice">{{ s.invoiceNum || 'Invoice' }}</div>
                   <div class="ghk-multi-clinic" *ngIf="s.clinicName">{{ s.clinicName }}</div>
                 </div>
                 <div class="ghk-multi-amount"> 
                   <div class="ghk-multi-value">$ {{ getGrandTotalForSummary(s) | number:'1.2-2' }}</div>
                 </div>
                 <div class="ghk-multi-chevron" [class.open]="isSummaryExpanded(i)">&#9662;</div>
               </button>

               <div class="ghk-multi-body" *ngIf="isSummaryExpanded(i)">
                 <div class="ghk-billing-summary">
                   <div class="ghk-bgrp" *ngIf="getHospitalItemsForSummary(s).length">
                     <div class="ghk-btitle">
                       <span>HOSPITAL FEE</span>
                       <span lang="zh" class="ghk-zh-line">醫院收費</span>
                     </div>

                     <div class="ghk-brow" *ngFor="let it of getHospitalItemsForSummary(s)">
                       <div class="ghk-bname">{{ it.itemName }}</div>
                       <div class="ghk-bamt">{{ it.totalCharge | number:'1.2-2' }}</div>
                     </div>

                     <div class="ghk-bsubtotal">
                       <div>
                         <span>Total Hospital Charges</span><br>
                         <span lang="zh" class="ghk-zh-line">總醫院收費</span>
                       </div>
                       <div class="ghk-bamt">{{ getHospitalTotalForSummary(s) | number:'1.2-2' }}</div>
                     </div>
                   </div>

                   <div class="ghk-ticket-status-divider"></div>

                   <div class="ghk-bgrp" *ngIf="getDoctorItemsForSummary(s).length">
                     <div class="ghk-btitle">
                       <span>DOCTOR FEE</span>
                       <span lang="zh" class="ghk-zh-line">醫生收費</span>
                     </div>

                     <div class="ghk-brow" *ngFor="let it of getDoctorItemsForSummary(s)">
                       <div class="ghk-bname">{{ it.itemName }}</div>
                       <div class="ghk-bamt">{{ it.totalCharge | number:'1.2-2' }}</div>
                     </div>

                     <div class="ghk-bsubtotal">
                       <div>
                         <span>Total Doctor Charges</span><br>
                         <span lang="zh" class="ghk-zh-line">總醫生收費</span>
                       </div>
                       <div class="ghk-bamt">{{ getDoctorTotalForSummary(s) | number:'1.2-2' }}</div>
                     </div>
                   </div>

                   <div class="ghk-ticket-status-divider" *ngIf="getDiscountItemsForSummary(s).length"></div>

                   <div class="ghk-bgrp" *ngIf="getDiscountItemsForSummary(s).length">
                     <div class="ghk-btitle">
                       <span>LESS</span>
                       <span lang="zh" class="ghk-zh-line">扣減</span>
                     </div>

                     <div class="ghk-brow" *ngFor="let it of getDiscountItemsForSummary(s)">
                       <div class="ghk-bname">{{ it.itemName }}</div>
                       <div class="ghk-bamt">{{ it.totalCharge | number:'1.2-2' }}</div>
                     </div>

                     <div class="ghk-bsubtotal">
                       <div>
                         <span>LESS</span><br>
                         <span lang="zh" class="ghk-zh-line">扣減</span>
                       </div>
                       <div class="ghk-bamt">{{ getDiscountTotalForSummary(s) | number:'1.2-2' }}</div>
                     </div>
                   </div>

                   <div class="ghk-ticket-status-divider"></div>

                   <div class="ghk-btotal">
                     <div>
                       <span>Grand Total</span><br>
                       <span lang="zh" class="ghk-zh-line">總額</span>
                     </div>
                     <div class="ghk-bamt">{{ getGrandTotalForSummary(s) | number:'1.2-2' }}</div>
                   </div>
                 </div>
               </div>
             </div>
           </div>

            </div>
          </div>
        </div>
      </section>
    </main>
  `,
  styles: [`
.apple-pay-button {
  -webkit-appearance: -apple-pay-button;
  -apple-pay-button-type: checkout; /* buy | checkout | plain */
  -apple-pay-button-style: black; /* black | white | white-outline */
  width: 100%;
  height: 44px;
}
.ghk-billing-summary {
  margin: 1rem 0;
  font-size: 0.95rem;
  color: #111;
}
.ghk-multi-billing {
  margin: 0.5rem 0 1rem;
}
.ghk-multi-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  margin: 0.6rem 0;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}
.ghk-multi-header {
  width: 100%;
  border: 0;
  background: #f8fafc;
  display: grid;
  grid-template-columns: 1fr auto 16px;
  gap: 12px;
  align-items: center;
  text-align: left;
  padding: 10px 12px;
  cursor: pointer;
}
.ghk-multi-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ghk-multi-invoice {
  font-weight: 700;
  color: #0f172a;
}
.ghk-multi-clinic {
  font-size: 0.9rem;
  color: #475569;
}
.ghk-multi-amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.ghk-multi-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #64748b;
}
.ghk-multi-value {
  font-weight: 700;
  color: #0f172a;
}
.ghk-multi-chevron {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1;
  color: #64748b;
  transition: transform 0.2s ease;
}
.ghk-multi-chevron.open {
  transform: rotate(180deg);
}
.ghk-multi-body {
  padding: 6px 12px 10px;
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
.ghk-busy-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.ghk-busy-panel {
  background: #fff;
  border-radius: 12px;
  padding: 18px 22px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.15);
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.ghk-busy-text {
  color: #0f172a;
  font-weight: 600;
  font-size: 0.95rem;
}
.ghk-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid #cbd5e1;
  border-top-color: #0f172a;
  border-radius: 50%;
  animation: ghk-spin 0.9s linear infinite;
}
.ghk-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
@keyframes ghk-spin { to { transform: rotate(360deg); } }
  `]
})
export class TicketStatusPage implements OnInit {
  ticketInfo: TicketInfo | null = null;
  showPaymentOptions = false;
  payError = '';
  payLoading = false;
  agreeTerms = false;
  expandedSummaryIndex: number | null = null;
  private apiUrl = '';
  ticketId: String | null = '';
  // Google Pay state
  private gpayClient: any | null = null;
  gpayReady = false;
  private wcfServiceUrl: string | null = null;
  gpayConfig: GooglePayConfig = {
    environment: 'TEST',
    merchantId: undefined,
    merchantName: 'Gleneagles Hospital Hong Kong',
    gateway: 'cybersource',
    gatewayMerchantId: 'gphk088031858218'
  };
  applePayAvailable = false;
  private applePaySession: any | null = null;
  get isReadyToPay(): boolean {
    const status = this.ticketInfo?.patientJourneyStatus?.toUpperCase();
    return status === 'INVOICED' || status === 'READY_TO_PAYMENT';
  }
  get showApplePay(): boolean {
    return this.applePayAvailable && this.isReadyToPay && !!this.ticketInfo?.canPayOnline;
  }
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

  toggleSummary(index: number) {
    this.expandedSummaryIndex = this.expandedSummaryIndex === index ? null : index;
  }

  isSummaryExpanded(index: number): boolean {
    return this.expandedSummaryIndex === index;
  }

  private getSummaryItems(summary: MultiBillingSummary | null | undefined): MultiBillingItem[] {
    return summary?.items ?? [];
  }

  getHospitalItemsForSummary(summary: MultiBillingSummary | null | undefined): MultiBillingItem[] {
    return this.getSummaryItems(summary).filter(i => (i.type ?? '').toUpperCase() === 'HF');
  }

  getDoctorItemsForSummary(summary: MultiBillingSummary | null | undefined): MultiBillingItem[] {
    return this.getSummaryItems(summary).filter(i => (i.type ?? '').toUpperCase() === 'DF');
  }

  getDiscountItemsForSummary(summary: MultiBillingSummary | null | undefined): MultiBillingItem[] {
    return this.getSummaryItems(summary).filter(i => (i.type ?? '').toUpperCase() === 'DC');
  }

  getHospitalTotalForSummary(summary: MultiBillingSummary | null | undefined): number {
    return this.getHospitalItemsForSummary(summary).reduce((s, i) => s + (i.totalCharge || 0), 0);
  }

  getDoctorTotalForSummary(summary: MultiBillingSummary | null | undefined): number {
    return this.getDoctorItemsForSummary(summary).reduce((s, i) => s + (i.totalCharge || 0), 0);
  }

  getDiscountTotalForSummary(summary: MultiBillingSummary | null | undefined): number {
    return this.getDiscountItemsForSummary(summary).reduce((s, i) => s + (i.totalCharge || 0), 0);
  }

  getGrandTotalForSummary(summary: MultiBillingSummary | null | undefined): number {
    return this.getHospitalTotalForSummary(summary) + this.getDoctorTotalForSummary(summary) + this.getDiscountTotalForSummary(summary);
  }

  ngOnInit() {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    this.ticketId = params.get('data');
    this.checkApplePayAvailability();

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
            if (this.showPaymentOptions && this.ticketInfo?.canPayOnline) {
              setTimeout(() => this.startGooglePay(), 0);
            }
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
              statusMessageEn: 'We\'re currently experiencing a temporary service disruption. Our team is working to resolve the issue as quickly as possible. Thank you for your patience.',
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

  onPay(method: 'visa' | 'mastercard' | 'cup' | 'jcb' | 'amex' | 'card' | 'googlepay' | 'wechatpay' | 'alipay' | 'applepay') {
    if (this.payLoading) return;
    this.payError = '';
    if (!this.ticketInfo?.isSuccess || !this.apiUrl || !this.ticketInfo.displayTicketNumber) {
      this.payError = 'Payment is not available right now.';
      return;
    }

    if (method === 'googlepay') {
      this.startGooglePay();
      return;
    }
    if (method === 'applepay') {
      this.startApplePay();
      return;
    }

    const body = {
      ticketNumber: this.ticketId,
      method
    };

    this.payLoading = true;
    this.http.post<PaymentInitResponse>(`${this.apiUrl}/api/Ticket/InitiatePayment`, body, { withCredentials: true })
      .subscribe({
        next: res => {
          this.payLoading = false;
          this.submitToGateway(res);
        },
        error: _ => {
          this.payLoading = false;
          this.payError = 'Unable to initiate payment. Please try again.';
        }
      });
  }

  openPaymentOptions() {
    this.showPaymentOptions = true;
    this.cd.markForCheck();
    if (this.ticketInfo?.canPayOnline) {
      setTimeout(() => this.startGooglePay(), 0);
    }
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

  // --- Apple Pay integration ---
  private async checkApplePayAvailability() {
    console.log('[ApplePay] Checking availability...');
    if (typeof window === 'undefined') return;
    const sessionCtor = (window as any).ApplePaySession;
    if (!sessionCtor || (typeof sessionCtor.supportsVersion === 'function' && !sessionCtor.supportsVersion(3))) {
      console.log('[ApplePay] ApplePaySession unavailable or version < 3');
      this.applePayAvailable = false;
      return;
    }

    try {
      const canPay = await sessionCtor.canMakePayments();
      console.log('[ApplePay] canMakePayments result:', canPay);
      this.zone.run(() => {
        this.applePayAvailable = !!canPay;
        this.cd.markForCheck();
      });
    } catch (err) {
      console.warn('[ApplePay] canMakePayments threw', err);
      this.zone.run(() => {
        this.applePayAvailable = false;
        this.cd.markForCheck();
      });
    }
  }

  async startApplePay() {
    this.payError = '';
    if (!this.apiUrl || !this.ticketInfo?.isSuccess) {
      this.payError = 'Apple Pay is not available right now.';
      return;
    }

    if (!this.showApplePay) {
      this.payError = 'Apple Pay is not available on this device.';
      return;
    }

    const request = this.buildApplePayRequest();
    const SessionCtor = (window as any).ApplePaySession;
    const supportsVersion = !SessionCtor?.supportsVersion || SessionCtor.supportsVersion(3);
    if (!SessionCtor || !request || !supportsVersion) {
      this.payError = 'Apple Pay cannot be started.';
      return;
    }

    try {
      this.applePaySession = new SessionCtor(3, request);
    } catch {
      this.payError = 'Apple Pay cannot be started.';
      this.applePaySession = null;
      return;
    }

    this.applePaySession.onvalidatemerchant = (event: any) => this.handleApplePayMerchantValidation(event?.validationURL);
    this.applePaySession.onpaymentauthorized = (event: any) => this.handleApplePayPaymentAuthorized(event?.payment);
    this.applePaySession.oncancel = () => { this.payError = 'Payment cancelled.'; };

    try {
      this.applePaySession.begin();
    } catch {
      this.payError = 'Unable to open Apple Pay sheet.';
      this.applePaySession = null;
    }
  }

  private buildApplePayRequest() {
    const amount = Math.max(0, (this.balanceDue) || 0).toFixed(2);
    const label = this.ticketInfo?.clinicNameEn || this.ticketInfo?.statusMessageEn || 'Hospital Payment';
    return {
      countryCode: 'HK',
      currencyCode: 'HKD',
      total: { label, amount },
      supportedNetworks: ['visa', 'masterCard', 'chinaUnionPay'],
      merchantCapabilities: ['supports3DS']
    };
  }

  private async handleApplePayMerchantValidation(validationUrl?: string) {
    if (!this.applePaySession || !validationUrl || !this.apiUrl) {
      this.payError = 'Unable to validate Apple Pay merchant.';
      this.applePaySession?.abort();
      this.applePaySession = null;
      return;
    }

    try {
      const merchantSession = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/api/payments/applepay/validate-merchant`, { validationUrl }, { withCredentials: true })
      );
      this.applePaySession.completeMerchantValidation(merchantSession);
    } catch {
      this.payError = 'Unable to validate Apple Pay merchant.';
      try { this.applePaySession.abort(); } catch { }
      this.applePaySession = null;
    }
  }

  private async handleApplePayPaymentAuthorized(payment: any) {
    if (!this.applePaySession || !this.apiUrl) {
      this.payError = 'Apple Pay authorization failed.';
      return;
    }

    try {
      const paymentData = payment?.token?.paymentData;
      if (!paymentData) {
        this.payError = 'Missing Apple Pay payment data.';
        this.applePaySession.completePayment((ApplePaySession as any).STATUS_FAILURE);
        this.applePaySession = null;
        return;
      }

      const paymentDataBase64 = this.toBase64(JSON.stringify(paymentData));
      const ticketNumber = this.ticketId ?? this.ticketInfo?.displayTicketNumber ?? '';
      const body = {
        ticketNumber,
        method: 'applepay',
        applePayPaymentDataBase64: paymentDataBase64
      };

      this.payLoading = true;

      this.http.post<any>(`${this.apiUrl}/api/Ticket/InitiatePayment`, body, { withCredentials: true })
        .subscribe({
          next: res => {
            this.payLoading = false;
            this.applePaySession.completePayment((ApplePaySession as any).STATUS_SUCCESS);
            this.applePaySession = null;
            const redirect = res?.redirectUrl;
            if (redirect) {
              window.location.href = redirect;
              return;
            }
          },
          error: (err) => {
            this.payLoading = false;
            this.applePaySession.completePayment((ApplePaySession as any).STATUS_FAILURE);
            this.applePaySession = null; const redirect = err?.error?.redirectUrl;
            if (redirect) {
              window.location.href = redirect;
              return;
            }
            this.payError = 'Apple Pay payment setup incomplete.';
          }
        });



    } catch {
      this.payLoading = false;
      try { this.applePaySession.completePayment((ApplePaySession as any).STATUS_FAILURE); } catch { }
      this.applePaySession = null;
      this.payError = 'Apple Pay authorization failed. Please try again.';
    }
  }

  private toBase64(str: string): string {
    return btoa(unescape(encodeURIComponent(str)));
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
      const btn = this.gpayClient.createButton({
        buttonColor: 'default',
        buttonType: 'pay',
        buttonRadius: 4,
        buttonBorderType: 'default_border',
        onClick: () => this.loadGooglePaymentData(),
        allowedPaymentMethods: [this.getGoogleCardPaymentMethod()]
      });
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

      this.payLoading = true;
      this.http.post<any>(url, body, { withCredentials: true }).subscribe({
        next: (res) => {
          this.payLoading = false;
          const redirect = res?.redirectUrl;
          if (redirect) {
            window.location.href = redirect;
            return;
          }
          this.payError = 'Payment processed but no redirect provided.';
        },
        error: (err) => {
          this.payLoading = false;
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
