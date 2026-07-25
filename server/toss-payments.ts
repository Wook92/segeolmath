import fetch from "node-fetch";
import { decrypt } from "./crypto";

const TOSS_API_URL = "https://api.tosspayments.com/v1";

const TOSS_MAX_RETRIES = 2;

function getEncodedSecretKey(secretKey: string): string {
  return Buffer.from(secretKey + ":").toString("base64");
}

function isRetriableTossError(err: any): boolean {
  const code = err?.code || err?.errno;
  return (
    code === "ERR_STREAM_PREMATURE_CLOSE" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "EPIPE" ||
    err?.type === "system"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Toss API 호출 공용 래퍼.
// - compress: false 로 gzip 응답을 받지 않아 node-fetch의 Gunzip 스트림
//   조기 종료(ERR_STREAM_PREMATURE_CLOSE) 문제를 원천 차단한다.
// - 일시적 네트워크/스트림 오류는 재시도한다. Toss 결제 승인/조회/자동결제는
//   paymentKey/orderId 기준으로 멱등하므로 재시도가 안전하다.
async function tossRequest(
  url: string,
  init: any
): Promise<{ ok: boolean; status: number; data: any }> {
  let lastErr: any;
  for (let attempt = 0; attempt <= TOSS_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { ...init, compress: false });
      const status = response.status;
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      return { ok: response.ok, status, data };
    } catch (err: any) {
      lastErr = err;
      if (!isRetriableTossError(err) || attempt === TOSS_MAX_RETRIES) {
        throw err;
      }
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastErr;
}

export interface TossPaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  method: string;
  requestedAt: string;
  approvedAt: string;
  card?: {
    company: string;
    number: string;
    installmentPlanMonths: number;
  };
  virtualAccount?: {
    accountNumber: string;
    bank: string;
    dueDate: string;
  };
  transfer?: {
    bank: string;
  };
  easyPay?: {
    provider: string;
  };
}

export async function confirmPaymentWithKey(
  request: TossPaymentConfirmRequest,
  encryptedSecretKey: string
): Promise<TossPaymentResponse> {
  const secretKey = decrypt(encryptedSecretKey);
  const encodedKey = getEncodedSecretKey(secretKey);

  const { ok, data } = await tossRequest(`${TOSS_API_URL}/payments/confirm`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paymentKey: request.paymentKey,
      orderId: request.orderId,
      amount: request.amount,
    }),
  });

  if (!ok) {
    throw new Error(data.message || "Payment confirmation failed");
  }

  return data as TossPaymentResponse;
}

export async function getPaymentWithKey(paymentKey: string, encryptedSecretKey: string): Promise<TossPaymentResponse> {
  const secretKey = decrypt(encryptedSecretKey);
  const encodedKey = getEncodedSecretKey(secretKey);

  const { ok, data } = await tossRequest(`${TOSS_API_URL}/payments/${paymentKey}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${encodedKey}`,
    },
  });

  if (!ok) {
    throw new Error(data.message || "Failed to get payment");
  }

  return data as TossPaymentResponse;
}

// orderId로 결제 조회 (GET /v1/payments/orders/{orderId})
// 결제가 존재하지 않으면 토스가 404를 반환하므로 null을 돌려준다.
export async function getPaymentByOrderIdWithKey(
  orderId: string,
  encryptedSecretKey: string
): Promise<TossPaymentResponse | null> {
  const secretKey = decrypt(encryptedSecretKey);
  const encodedKey = getEncodedSecretKey(secretKey);

  const { ok, status, data } = await tossRequest(
    `${TOSS_API_URL}/payments/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${encodedKey}`,
      },
    }
  );

  if (status === 404) {
    return null;
  }

  if (!ok) {
    throw new Error(data.message || "Failed to get payment by orderId");
  }
  return data as TossPaymentResponse;
}

// orderId로 결제 조회 (환경변수 시크릿키 사용)
export async function getPaymentByOrderId(orderId: string): Promise<TossPaymentResponse | null> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    throw new Error("TOSS_SECRET_KEY is not configured");
  }
  const encodedKey = getEncodedSecretKey(secretKey);

  const { ok, status, data } = await tossRequest(
    `${TOSS_API_URL}/payments/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${encodedKey}`,
      },
    }
  );

  if (status === 404) {
    return null;
  }

  if (!ok) {
    throw new Error(data.message || "Failed to get payment by orderId");
  }
  return data as TossPaymentResponse;
}

export async function cancelPaymentWithKey(
  paymentKey: string,
  cancelReason: string,
  encryptedSecretKey: string,
  cancelAmount?: number
): Promise<TossPaymentResponse> {
  const secretKey = decrypt(encryptedSecretKey);
  const encodedKey = getEncodedSecretKey(secretKey);

  const body: any = { cancelReason };
  if (cancelAmount) {
    body.cancelAmount = cancelAmount;
  }

  const { ok, data } = await tossRequest(`${TOSS_API_URL}/payments/${paymentKey}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!ok) {
    throw new Error(data.message || "Payment cancellation failed");
  }

  return data as TossPaymentResponse;
}

export function getDecryptedClientKey(encryptedClientKey: string): string {
  return decrypt(encryptedClientKey);
}

export function isTossPaymentsConfiguredForCenter(
  tossClientKey: string | null | undefined,
  tossSecretKey: string | null | undefined
): boolean {
  return !!(tossClientKey && tossSecretKey);
}

export function isTossPaymentsConfigured(): boolean {
  return !!(process.env.TOSS_CLIENT_KEY && process.env.TOSS_SECRET_KEY);
}

export function getClientKey(): string {
  const clientKey = process.env.TOSS_CLIENT_KEY;
  if (!clientKey) {
    throw new Error("TOSS_CLIENT_KEY is not configured");
  }
  return clientKey;
}

export async function confirmPayment(
  request: TossPaymentConfirmRequest
): Promise<TossPaymentResponse> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    throw new Error("TOSS_SECRET_KEY is not configured");
  }
  const encodedKey = getEncodedSecretKey(secretKey);

  const { ok, data } = await tossRequest(`${TOSS_API_URL}/payments/confirm`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paymentKey: request.paymentKey,
      orderId: request.orderId,
      amount: request.amount,
    }),
  });

  if (!ok) {
    throw new Error(data.message || "Payment confirmation failed");
  }

  return data as TossPaymentResponse;
}

// ──────────────────────────────────────────────────────────────────────────
// Billing (자동결제) — 최초 1회 카드 등록 후 빌링키로 무인 결제
// ──────────────────────────────────────────────────────────────────────────

export interface TossBillingIssueResponse {
  mId: string;
  customerKey: string;
  authenticatedAt: string;
  method: string;
  billingKey: string;
  cardCompany?: string;
  cardNumber?: string; // 마스킹된 카드번호 (예: "433012******1234")
  card?: {
    issuerCode: string;
    acquirerCode: string;
    number: string;
    cardType: string;
    ownerType: string;
  };
}

export interface TossBillingChargeResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  method: string;
  approvedAt: string;
  card?: {
    company: string;
    number: string;
    installmentPlanMonths: number;
  };
}

// authKey + customerKey → billingKey 발급
export async function issueBillingKey(
  authKey: string,
  customerKey: string,
  encryptedSecretKey: string
): Promise<TossBillingIssueResponse> {
  const secretKey = decrypt(encryptedSecretKey);
  const encodedKey = getEncodedSecretKey(secretKey);

  const { ok, data } = await tossRequest(`${TOSS_API_URL}/billing/authorizations/issue`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ authKey, customerKey }),
  });

  if (!ok) {
    throw new Error(data.message || "빌링키 발급 실패");
  }
  return data as TossBillingIssueResponse;
}

// 빌링키로 자동결제 실행
export async function chargeWithBillingKey(
  params: {
    billingKey: string;
    customerKey: string;
    amount: number;
    orderId: string;
    orderName: string;
    customerEmail?: string;
    customerName?: string;
  },
  encryptedSecretKey: string
): Promise<TossBillingChargeResponse> {
  const secretKey = decrypt(encryptedSecretKey);
  const encodedKey = getEncodedSecretKey(secretKey);

  const { ok, data } = await tossRequest(
    `${TOSS_API_URL}/billing/${params.billingKey}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${encodedKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerKey: params.customerKey,
        amount: params.amount,
        orderId: params.orderId,
        orderName: params.orderName,
        customerEmail: params.customerEmail,
        customerName: params.customerName,
      }),
    }
  );

  if (!ok) {
    throw new Error(data.message || "자동결제 실패");
  }
  return data as TossBillingChargeResponse;
}
