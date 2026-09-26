export const SESSION_COOKIE_NAME = "heycapy_session";
export const SESSION_DURATION_DAYS = process.env.SESSION_DURATION_DAYS
  ? Math.max(1, parseInt(process.env.SESSION_DURATION_DAYS, 10))
  : 30;
export const OTP_TTL_MINUTES = 10;
export const OTP_LENGTH = 6;
