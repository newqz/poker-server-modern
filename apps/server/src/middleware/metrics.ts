/**
 * Prometheus 监控指标
 * @module middleware/metrics
 */

import { Request, Response, NextFunction } from 'express';

// 简单的内存指标收集器（生产环境建议使用 prom-client）
const metrics = {
  // 请求计数
  requests: {
    total: 0,
    byStatus: {} as Record<string, number>,
    byRoute: {} as Record<string, number>
  },
  // 响应时间
  responseTime: {
    sum: 0,
    count: 0,
    min: Infinity,
    max: 0
  },
  // 游戏状态
  games: {
    active: 0,
    totalPlayed: 0,
    totalPlayers: 0
  },
  // 连接状态
  connections: {
    socket: 0,
    authenticated: 0
  },
  // 最后更新
  lastUpdate: new Date().toISOString()
};

/**
 * 更新请求指标
 */
export function recordRequest(route: string, statusCode: number, responseTimeMs: number): void {
  metrics.requests.total++;
  metrics.requests.byStatus[statusCode] = (metrics.requests.byStatus[statusCode] || 0) + 1;
  metrics.requests.byRoute[route] = (metrics.requests.byRoute[route] || 0) + 1;
  
  metrics.responseTime.sum += responseTimeMs;
  metrics.responseTime.count++;
  metrics.responseTime.min = Math.min(metrics.responseTime.min, responseTimeMs);
  metrics.responseTime.max = Math.max(metrics.responseTime.max, responseTimeMs);
  metrics.lastUpdate = new Date().toISOString();
}

/**
 * 更新活跃游戏数
 */
export function setActiveGames(count: number): void {
  metrics.games.active = count;
  metrics.lastUpdate = new Date().toISOString();
}

/**
 * 更新连接数
 */
export function setConnections(socketCount: number, authenticatedCount: number): void {
  metrics.connections.socket = socketCount;
  metrics.connections.authenticated = authenticatedCount;
  metrics.lastUpdate = new Date().toISOString();
}

/**
 * 增加游戏计数
 */
export function incrementGamesPlayed(): void {
  metrics.games.totalPlayed++;
  metrics.lastUpdate = new Date().toISOString();
}

/**
 * 指标中间件
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    recordRequest(req.route?.path || req.path, res.statusCode, duration);
  });
  
  next();
}

/**
 * 获取指标
 */
export function getMetrics() {
  const avgResponseTime = metrics.responseTime.count > 0 
    ? metrics.responseTime.sum / metrics.responseTime.count 
    : 0;
  
  return {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    requests: {
      total: metrics.requests.total,
      byStatus: { ...metrics.requests.byStatus },
      byRoute: { ...metrics.requests.byRoute }
    },
    responseTime: {
      avg: Math.round(avgResponseTime),
      min: Math.round(metrics.responseTime.min),
      max: Math.round(metrics.responseTime.max)
    },
    games: { ...metrics.games },
    connections: { ...metrics.connections },
    lastUpdate: metrics.lastUpdate
  };
}

/**
 * Prometheus 格式指标
 */
export function getPrometheusMetrics(): string {
  const m = getMetrics();
  
  const lines = [
    '# HELP poker_uptime Server uptime in seconds',
    '# TYPE poker_uptime counter',
    `poker_uptime ${m.uptime}`,
    '',
    '# HELP poker_requests_total Total HTTP requests',
    '# TYPE poker_requests_total counter',
    `poker_requests_total ${m.requests.total}`,
    '',
    '# HELP poker_games_active Active games',
    '# TYPE poker_games_active gauge',
    `poker_games_active ${m.games.active}`,
    '',
    '# HELP poker_games_total_played Total games played',
    '# TYPE poker_games_total_played counter',
    `poker_games_total_played ${m.games.totalPlayed}`,
    '',
    '# HELP poker_connections_socket Socket.io connections',
    '# TYPE poker_connections_socket gauge',
    `poker_connections_socket ${m.connections.socket}`,
    '',
    '# HELP poker_memory_usage_bytes Memory usage in bytes',
    '# TYPE poker_memory_usage_bytes gauge',
    `poker_memory_usage_bytes{type="rss"} ${m.memory.rss}`,
    `poker_memory_usage_bytes{type="heapUsed"} ${m.memory.heapUsed}`,
    '',
    '# HELP poker_response_time_avg Average response time in ms',
    '# TYPE poker_response_time_avg gauge',
    `poker_response_time_avg ${m.responseTime.avg}`,
  ];
  
  return lines.join('\n');
}
