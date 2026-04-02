/**
 * 服务器创建
 * @module server
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 */

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

import { logger } from './utils/logger';
import { serializeBigInt } from './utils/serialize';
import { errorHandler } from './middleware/errorHandler';
import { validateEnvironment } from './middleware/startupValidation';
import { setupRoutes } from './routes';
import { setupSocketHandlers } from './services/socket';
import { gameService } from './services/game';
import { rateLimiter } from './utils/rateLimiter';

// 启动时校验环境变量
validateEnvironment();

// 初始化分布式速率限制器
const REDIS_URL = process.env.REDIS_URL?.replace(/\?.*$/, ''); // 移除查询参数
if (REDIS_URL) {
  const redisUrlForLimiter = REDIS_URL.startsWith('redis://:') 
    ? REDIS_URL 
    : REDIS_URL.replace('redis://', `redis://:${process.env.REDIS_PASSWORD || ''}@`);
  await rateLimiter.initialize(redisUrlForLimiter);
} else {
  await rateLimiter.initialize();
}

export async function createServer(): Promise<{ app: express.Application; server: http.Server; io: Server }> {
  const app = express();
  const server = http.createServer(app);
  
  // CORS 配置：禁止使用通配符
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin) {
    throw new Error('CORS_ORIGIN environment variable must be set');
  }
  if (corsOrigin === '*') {
    throw new Error('CORS_ORIGIN cannot be "*" in production');
  }
  
  // 创建 Socket.io 实例
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // 配置 Redis Adapter 支持多实例
  const redisUrl = process.env.REDIS_URL;
  const redisPassword = process.env.REDIS_PASSWORD;
  
  if (redisUrl) {
    try {
      const pubClient = createClient({ url: redisUrl, password: redisPassword });
      const subClient = pubClient.duplicate();
      
      await Promise.all([pubClient.connect(), subClient.connect()]);
      
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.io Redis adapter configured');
    } catch (error) {
      logger.error({ error }, 'Failed to configure Socket.io Redis adapter');
    }
  } else {
    logger.warn('REDIS_URL not configured, Socket.io will not work with multiple replicas');
  }

  // 安全中间件 - Helmet 已包含大部分安全头
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  
  app.use(cors({
    origin: corsOrigin,
    credentials: true
  }));

  // 限流中间件
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 每个IP限制100个请求
    message: { error: 'Too many requests, please try again later' }
  });
  app.use(limiter);

  // 额外安全头
  app.use((req, res, next) => {
    // 防止点击劫持
    res.setHeader('X-Frame-Options', 'DENY');
    // 防止 MIME 类型 sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // 严格的引用来源
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // XSS 保护（旧的浏览器）
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // 权限策略
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });

  // 解析中间件
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());

  // BigInt 序列化中间件：将 BigInt 转换为数字
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      const serialized = serializeBigInt(body);
      return originalJson(serialized);
    };
    next();
  });

  // 请求日志
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    next();
  });

  // 健康检查
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Prometheus 指标端点
  app.get('/metrics', (req, res) => {
    const { getPrometheusMetrics } = require('./middleware/metrics');
    res.set('Content-Type', 'text/plain');
    res.send(getPrometheusMetrics());
  });

  // API 路由
  setupRoutes(app);

  // Socket.io 处理
  setupSocketHandlers(io);

  // 错误处理
  app.use(errorHandler);

  // 恢复进行中的游戏
  try {
    await gameService.recoverAllGames();
  } catch (error) {
    logger.error({ error }, 'Failed to recover games on startup');
  }

  // 启动快照保存定时器
  gameService.startSnapshotScheduler();

  // 服务器关闭时保存所有游戏快照
  const shutdown = async () => {
    logger.info('Server shutting down, saving game snapshots...');
    await gameService.saveAllSnapshots();
    gameService.stopSnapshotScheduler();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { app, server, io };
}
