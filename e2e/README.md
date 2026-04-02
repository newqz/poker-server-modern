# E2E 测试指南

## 概述

使用 Playwright 进行端到端测试，覆盖核心用户流程。

## 测试文件

- `auth.spec.ts` - 认证流程测试
- `room.spec.ts` - 房间管理测试

## 快速开始

### 1. 安装依赖

```bash
npm install
npx playwright install
```

### 2. 启动服务

```bash
# 启动后端服务
npm run dev --workspace=@poker/server

# 或使用 Docker
docker-compose -f infra/docker/docker-compose.dev.yml up -d
```

### 3. 运行测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 使用 UI 模式运行
npm run test:e2e:ui

# 在有头模式运行
npm run test:e2e:headed

# 只运行特定测试
npx playwright test auth.spec.ts
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `E2E_API_URL` | `http://localhost:3000/api/v1` | API 地址 |
| `CI` | - | 设为 true 时启用 CI 模式 |

## 测试场景

### 认证测试

- ✅ 用户注册
- ✅ 用户登录
- ✅ 登录失败 (错误密码)
- ✅ 重复邮箱注册
- ✅ Token 刷新
- ✅ 用户登出
- ✅ 获取用户信息
- ✅ 未授权访问

### 房间测试

- ✅ 创建房间
- ✅ 获取房间列表
- ✅ 加入房间
- ✅ 离开房间
- ✅ 准备开始游戏

## 报告

测试完成后，HTML 报告保存在 `playwright-report/` 目录。

```bash
# 查看报告
npx playwright show-report
```

## CI 集成

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
        env:
          CI: true
          E2E_API_URL: ${{ secrets.E2E_API_URL }}
```
