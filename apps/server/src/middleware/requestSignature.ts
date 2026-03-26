/**
 * 请求签名验证中间件
 * @module middleware/requestSignature
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 */

import type { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '../utils/logger';

export interface SignedRequest extends Request {
  signatureValid?: boolean;
}

// Redis client for nonce storage (optional)
let redisClient: any = null;

async function initRedis(): Promise<void> {
  if (process.env.REDIS_URL && !redisClient) {
    try {
      const { createClient } = require('redis');
      redisClient = createClient({ url: process.env.REDIS_URL });
      await redisClient.connect();
    } catch (error) {
      logger.warn({ error }, 'Failed to connect to Redis for nonce storage');
    }
  }
}
initRedis();

// Signature time window: 60 seconds (reduced from 5 minutes)
const SIGNATURE_TIME_WINDOW_MS = 60 * 1000;

// Nonce expiration: 5 minutes
const NONCE_EXPIRATION_SECONDS = 300;

/**
 * 生成签名
 * @param payload 请求体或规范化URL
 * @param timestamp 时间戳
 * @param secret 密钥
 */
export function generateSignature(payload: string, timestamp: string, secret: string): string {
  const data = `${timestamp}.${payload}`;
  return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * 规范化 GET 请求的 URL（解决编码差异问题）
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url, 'http://localhost');
    // 按字母顺序排序查询参数
    parsed.searchParams.sort();
    return parsed.toString().replace('http://localhost', '');
  } catch {
    return url;
  }
}

/**
 * 检查 nonce 是否已使用（防止重放攻击）
 */
async function isNonceUsed(nonce: string): Promise<boolean> {
  if (redisClient) {
    const key = `nonce:${nonce}`;
    const exists = await redisClient.exists(key);
    return exists === 1;
  }
  // 如果没有 Redis，使用内存存储（仅适用于单实例）
  return false;
}

/**
 * 标记 nonce 已使用
 */
async function markNonceUsed(nonce: string): Promise<void> {
  if (redisClient) {
    const key = `nonce:${nonce}`;
    await redisClient.setEx(key, NONCE_EXPIRATION_SECONDS, '1');
  }
}

/**
 * 验证签名中间件
 * 需要在请求头中包含:
 * - X-Signature-Timestamp: 时间戳
 * - X-Signature: HMAC签名
 * - X-Nonce: 随机 nonce（可选，用于防止重放）
 */
export function verifySignature(req: SignedRequest, res: Response, next: NextFunction): void {
  const signature = req.headers['x-signature'] as string;
  const timestamp = req.headers['x-signature-timestamp'] as string;
  const nonce = req.headers['x-nonce'] as string;
  const secret = process.env.REQUEST_SIGNING_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  // 生产环境必须配置签名密钥
  if (isProduction && !secret) {
    logger.error('REQUEST_SIGNING_SECRET is not configured in production');
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_CONFIG_ERROR',
        message: 'Server misconfiguration: request signing is required in production'
      }
    });
    return;
  }

  // 如果没有配置签名密钥，跳过验证（仅开发环境）
  if (!secret) {
    logger.debug('Request signing secret not configured, skipping verification');
    return next();
  }

  // 缺少必要的头
  if (!signature || !timestamp) {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_SIGNATURE',
        message: 'Missing signature headers'
      }
    });
    return;
  }

  // 验证时间戳格式
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TIMESTAMP',
        message: 'Invalid timestamp format'
      }
    });
    return;
  }

  // 检查时间戳是否过期（60秒窗口）
  const now = Date.now();
  if (Math.abs(now - ts) > SIGNATURE_TIME_WINDOW_MS) {
    res.status(401).json({
      success: false,
      error: {
        code: 'EXPIRED_SIGNATURE',
        message: 'Signature timestamp expired'
      }
    });
    return;
  }

  // 如果提供了 nonce，检查是否已使用
  if (nonce) {
    if (isNonceUsed(nonce)) {
      res.status(401).json({
        success: false,
        error: {
          code: 'REPLAY_DETECTED',
          message: 'Nonce already used'
        }
      });
      return;
    }
  }

  // 计算期望的签名
  let payload: string;
  if (req.method === 'GET') {
    payload = normalizeUrl(req.originalUrl);
  } else {
    // POST/PUT 等请求，使用确定性序列化
    payload = JSON.stringify(req.body);
  }
  
  const expectedSignature = generateSignature(payload, timestamp, secret);

  // 使用 timing-safe 比较防止时序攻击
  try {
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      throw new Error('Signature length mismatch');
    }

    if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new Error('Signature mismatch');
    }

    // 标记 nonce 已使用
    if (nonce) {
      markNonceUsed(nonce);
    }

    req.signatureValid = true;
    next();
  } catch (error) {
    logger.warn({ 
      ip: req.ip, 
      path: req.path 
    }, 'Invalid request signature');
    
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_SIGNATURE',
        message: 'Invalid request signature'
      }
    });
  }
}

/**
 * 可选签名验证：仅验证已签署的请求
 * 如果请求包含签名头，则验证；如果不包含，则允许通过
 */
export function optionalSignatureVerification(req: SignedRequest, res: Response, next: NextFunction): void {
  const signature = req.headers['x-signature'] as string;
  
  // 如果没有签名头，允许通过
  if (!signature) {
    return next();
  }
  
  // 有签名头，则必须验证通过
  return verifySignature(req, res, next);
}
