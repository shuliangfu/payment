/**
 * @module @dreamer/payment/crypto
 *
 * 支付加密工具模块
 *
 * 基于 @dreamer/crypto 提供支付相关的加密功能：
 * - HMAC-SHA256 签名（Stripe Webhook）
 * - RSA-SHA256 签名（支付宝、微信支付）
 * - AES-GCM 解密（微信支付回调数据）
 * - 随机字符串生成
 */

import {
  hash,
  sign,
  verify,
  generateRandomString,
  generateRandomBytes,
} from "@dreamer/crypto";

// 重新导出常用工具函数
export { generateRandomString, generateRandomBytes, hash };

// ============================================================================
// 辅助工具函数
// ============================================================================

/**
 * 字符串转 ArrayBuffer
 * @param str - 输入字符串
 * @returns ArrayBuffer
 */
function stringToArrayBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

/**
 * ArrayBuffer 转字符串
 * @param buffer - ArrayBuffer
 * @returns 字符串
 */
function arrayBufferToString(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

/**
 * ArrayBuffer 转十六进制字符串
 * @param buffer - ArrayBuffer
 * @returns 十六进制字符串
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Base64 转 ArrayBuffer
 * @param base64 - Base64 字符串
 * @returns ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * ArrayBuffer 转 Base64
 * @param buffer - ArrayBuffer
 * @returns Base64 字符串
 */
function _arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// 导出用于其他模块使用
export { _arrayBufferToBase64 as arrayBufferToBase64 };

// ============================================================================
// HMAC 签名（用于 Stripe Webhook 验证）
// ============================================================================

/**
 * HMAC-SHA256 签名
 *
 * @param data - 要签名的数据
 * @param secret - 密钥
 * @returns 十六进制签名
 *
 * @example
 * ```typescript
 * const signature = await hmacSign("payload", "secret");
 * ```
 */
export async function hmacSign(data: string, secret: string): Promise<string> {
  const crypto = globalThis.crypto;
  const dataBuffer = stringToArrayBuffer(data);
  const keyBuffer = stringToArrayBuffer(secret);

  // 导入密钥
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // 签名
  const signature = await crypto.subtle.sign("HMAC", key, dataBuffer);
  return arrayBufferToHex(signature);
}

/**
 * HMAC-SHA256 验证
 *
 * @param data - 原始数据
 * @param signature - 待验证的签名（十六进制）
 * @param secret - 密钥
 * @returns 是否验证通过
 */
export async function hmacVerify(
  data: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const computed = await hmacSign(data, secret);
  // 使用恒定时间比较防止时序攻击
  return timingSafeEqual(computed, signature);
}

/**
 * 恒定时间字符串比较（防止时序攻击）
 *
 * @param a - 字符串 a
 * @param b - 字符串 b
 * @returns 是否相等
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ============================================================================
// Stripe Webhook 签名验证
// ============================================================================

/**
 * 验证 Stripe Webhook 签名
 *
 * @param payload - 请求体原始字符串
 * @param signature - Stripe-Signature 头
 * @param secret - Webhook 密钥（whsec_xxx）
 * @param tolerance - 时间戳容差（秒，默认 300）
 * @returns 是否验证通过
 */
export async function verifyStripeWebhook(
  payload: string,
  signature: string,
  secret: string,
  tolerance: number = 300,
): Promise<boolean> {
  // 解析签名头
  const sigParts = signature.split(",");
  const timestamp = sigParts.find((p) => p.startsWith("t="))?.split("=")[1];
  const v1Sig = sigParts.find((p) => p.startsWith("v1="))?.split("=")[1];

  if (!timestamp || !v1Sig) {
    return false;
  }

  // 验证时间戳（防止重放攻击）
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > tolerance) {
    return false;
  }

  // 构建签名负载
  const signedPayload = `${timestamp}.${payload}`;

  // 计算 HMAC-SHA256
  const expectedSig = await hmacSign(signedPayload, secret);

  // 比较签名
  return timingSafeEqual(expectedSig, v1Sig);
}

// ============================================================================
// RSA 签名（用于支付宝、微信支付）
// ============================================================================

/**
 * 从 PEM 格式导入 RSA 私钥
 *
 * @param pem - PEM 格式私钥
 * @returns CryptoKey
 */
export async function importRSAPrivateKey(pem: string): Promise<CryptoKey> {
  const crypto = globalThis.crypto;

  // 移除 PEM 头尾和换行
  const pemContent = pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryDer = base64ToArrayBuffer(pemContent);

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}

/**
 * 从 PEM 格式导入 RSA 公钥
 *
 * @param pem - PEM 格式公钥
 * @returns CryptoKey
 */
export async function importRSAPublicKey(pem: string): Promise<CryptoKey> {
  const crypto = globalThis.crypto;

  // 移除 PEM 头尾和换行
  const pemContent = pem
    .replace(/-----BEGIN (?:RSA )?PUBLIC KEY-----/, "")
    .replace(/-----END (?:RSA )?PUBLIC KEY-----/, "")
    .replace(/\s/g, "");

  const binaryDer = base64ToArrayBuffer(pemContent);

  return await crypto.subtle.importKey(
    "spki",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );
}

/**
 * RSA-SHA256 签名
 *
 * @param data - 要签名的数据
 * @param privateKey - 私钥（CryptoKey 或 PEM 字符串）
 * @returns Base64 编码的签名
 */
export async function rsaSign(
  data: string,
  privateKey: CryptoKey | string,
): Promise<string> {
  const key = typeof privateKey === "string"
    ? await importRSAPrivateKey(privateKey)
    : privateKey;

  return await sign(data, key, "rsa-sha256");
}

/**
 * RSA-SHA256 验证签名
 *
 * @param data - 原始数据
 * @param signature - Base64 编码的签名
 * @param publicKey - 公钥（CryptoKey 或 PEM 字符串）
 * @returns 是否验证通过
 */
export async function rsaVerify(
  data: string,
  signature: string,
  publicKey: CryptoKey | string,
): Promise<boolean> {
  const key = typeof publicKey === "string"
    ? await importRSAPublicKey(publicKey)
    : publicKey;

  return await verify(data, signature, key, "rsa-sha256");
}

// ============================================================================
// 支付宝签名
// ============================================================================

/**
 * 支付宝参数签名
 *
 * 按照支付宝规范对参数进行排序、拼接、签名
 *
 * @param params - 请求参数
 * @param privateKey - 商户私钥
 * @returns Base64 编码的签名
 */
export async function signAlipayParams(
  params: Record<string, string>,
  privateKey: string,
): Promise<string> {
  // 1. 过滤空值和 sign 参数，并排序
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== "" && params[k] !== undefined)
    .sort();

  // 2. 拼接待签名字符串
  const signStr = sortedKeys
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  // 3. RSA2 签名
  return await rsaSign(signStr, privateKey);
}

/**
 * 验证支付宝回调签名
 *
 * @param params - 回调参数
 * @param publicKey - 支付宝公钥
 * @returns 是否验证通过
 */
export async function verifyAlipaySignature(
  params: Record<string, string>,
  publicKey: string,
): Promise<boolean> {
  const { sign: signature, sign_type: _signType, ...rest } = params;

  if (!signature) {
    return false;
  }

  // 排序拼接
  const sortedKeys = Object.keys(rest)
    .filter((k) => rest[k] !== "" && rest[k] !== undefined)
    .sort();

  const signStr = sortedKeys
    .map((k) => `${k}=${rest[k]}`)
    .join("&");

  // 验证签名
  return await rsaVerify(signStr, signature, publicKey);
}

// ============================================================================
// 微信支付签名
// ============================================================================

/**
 * 微信支付 V3 签名
 *
 * @param method - HTTP 方法
 * @param url - 请求 URL（不含域名）
 * @param timestamp - 时间戳
 * @param nonceStr - 随机字符串
 * @param body - 请求体
 * @param privateKey - 商户私钥
 * @returns Base64 编码的签名
 */
export async function signWechatPayRequest(
  method: string,
  url: string,
  timestamp: number,
  nonceStr: string,
  body: string,
  privateKey: string,
): Promise<string> {
  // 构建签名串
  const signStr = `${method}\n${url}\n${timestamp}\n${nonceStr}\n${body}\n`;
  return await rsaSign(signStr, privateKey);
}

/**
 * 验证微信支付 V3 回调签名
 *
 * @param timestamp - Wechatpay-Timestamp 头
 * @param nonce - Wechatpay-Nonce 头
 * @param body - 请求体
 * @param signature - Wechatpay-Signature 头（Base64）
 * @param platformCert - 平台证书公钥
 * @returns 是否验证通过
 */
export async function verifyWechatPaySignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  platformCert: string,
): Promise<boolean> {
  // 构建验签串
  const signStr = `${timestamp}\n${nonce}\n${body}\n`;
  return await rsaVerify(signStr, signature, platformCert);
}

/**
 * 微信支付 V3 回调数据解密（AEAD_AES_256_GCM）
 *
 * @param ciphertext - Base64 编码的密文
 * @param associatedData - 附加数据
 * @param nonce - IV（12字节）
 * @param apiKey - API V3 密钥
 * @returns 解密后的明文
 */
export async function decryptWechatPayNotify(
  ciphertext: string,
  associatedData: string,
  nonce: string,
  apiKey: string,
): Promise<string> {
  const crypto = globalThis.crypto;

  // 解码密文
  const ciphertextBuffer = base64ToArrayBuffer(ciphertext);
  const nonceBuffer = new TextEncoder().encode(nonce);
  const associatedDataBuffer = new TextEncoder().encode(associatedData);
  const keyBuffer = new TextEncoder().encode(apiKey);

  // 导入密钥
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  // 解密
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: nonceBuffer,
      additionalData: associatedDataBuffer,
    },
    key,
    ciphertextBuffer,
  );

  return arrayBufferToString(decrypted);
}

// ============================================================================
// 通用工具
// ============================================================================

/**
 * 生成随机 32 位字符串（微信支付 nonce_str）
 *
 * @param length - 长度（默认 32）
 * @returns 随机字符串
 */
export function generateNonceStr(length: number = 32): string {
  return generateRandomString(length);
}

/**
 * 获取当前时间戳（秒）
 *
 * @returns Unix 时间戳
 */
export function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 格式化日期为支付宝格式（yyyy-MM-dd HH:mm:ss）
 *
 * @param date - 日期对象
 * @returns 格式化后的字符串
 */
export function formatAlipayDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
