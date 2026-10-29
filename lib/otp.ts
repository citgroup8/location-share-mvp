import { prisma } from '@/lib/prisma';
import { sendEmailOtp } from '@/lib/email';

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;
const enc = new TextEncoder();

async function otpKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set in .env');
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function generateOtp(): string {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(100_000 + (random[0]! % 900_000));
}

export async function hashOtp(email: string, code: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await otpKey(),
    enc.encode(`${email}:${code}`)
  );
  return toBase64Url(new Uint8Array(signature));
}

export async function verifyOtpHash(email: string, code: string, hash: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify(
      'HMAC',
      await otpKey(),
      fromBase64Url(hash),
      enc.encode(`${email}:${code}`)
    );
  } catch {
    return false;
  }
}

export class OtpRateLimitError extends Error {}
export class OtpDeliveryError extends Error {}

export async function issueEmailOtp(input: {
  email: string;
  purpose: 'signup' | 'login';
  username?: string;
  displayName?: string;
}): Promise<void> {
  const existing = await prisma.emailOtp.findUnique({ where: { email: input.email } });
  if (existing && Date.now() - existing.createdAt.getTime() < OTP_RESEND_WAIT_MS) {
    throw new OtpRateLimitError('Please wait before requesting another code');
  }

  const code = generateOtp();
  const codeHash = await hashOtp(input.email, code);
  const now = new Date();

  await prisma.emailOtp.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      codeHash,
      expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
      purpose: input.purpose,
      username: input.username,
      displayName: input.displayName
    },
    update: {
      codeHash,
      expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
      purpose: input.purpose,
      username: input.username,
      displayName: input.displayName,
      attempts: 0,
      createdAt: now
    }
  });

  try {
    await sendEmailOtp(input.email, code);
  } catch (error) {
    await prisma.emailOtp.deleteMany({ where: { email: input.email, codeHash } });
    throw new OtpDeliveryError('Could not send a verification code', { cause: error });
  }
}
