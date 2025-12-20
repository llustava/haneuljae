import adminConfig from "@/config/admins.json";

const allowedDomainRaw =
  process.env.NEXT_PUBLIC_FIREBASE_ALLOWED_DOMAIN ??
  process.env.NEXT_PUBLIC_ALLOWED_DOMAIN ??
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY_ALLOWED_DOMAIN ??
  "";

const normalizedAllowedDomain = allowedDomainRaw.trim().toLowerCase();

export const shouldEnforceDomain = Boolean(normalizedAllowedDomain);

export const domainErrorMessage = shouldEnforceDomain
  ? `올바른 도메인을 가진 이메일로 로그인 해 주세요.${normalizedAllowedDomain ? ` (${normalizedAllowedDomain})` : ""}`
  : "올바른 도메인을 가진 이메일로 로그인 해 주세요.";

export const isEmailAllowed = (email?: string | null) => {
  if (!shouldEnforceDomain) {
    return true;
  }

  return email?.toLowerCase().endsWith(normalizedAllowedDomain) ?? false;
};

const envAdminsRaw =
  process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

const jsonAdmins = Array.isArray(adminConfig) ? adminConfig : [];

const adminEmailSet = new Set(
  [...jsonAdmins, ...envAdminsRaw.split(",")]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

export const isAdminEmail = (email?: string | null) => {
  if (!email) {
    return false;
  }

  return adminEmailSet.has(email.toLowerCase());
};

export const BLOCK_COLLECTION = "blockedUsers";
export const BLOCK_ERROR_MESSAGE = "차단된 계정입니다. 관리자에게 문의하세요.";
export const formatBlockMessage = (reason?: string | null) =>
  reason && reason.trim()
    ? `${BLOCK_ERROR_MESSAGE} 사유: ${reason.trim()}`
    : BLOCK_ERROR_MESSAGE;
