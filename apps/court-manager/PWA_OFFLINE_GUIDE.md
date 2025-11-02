# Court Manager - PWA 离线计分功能

## 功能概述

Court Manager 现已支持 PWA（渐进式 Web 应用）功能，即使在网络不稳定或离线的情况下，也能正常计分，待网络恢复后自动同步数据到服务器。

## 核心特性

### 1. 离线计分
- ✅ 即使断网也能正常计分
- ✅ 所有比分数据自动保存到本地 IndexedDB
- ✅ 不会出现比分回退现象

### 2. 自动同步
- ✅ 网络恢复后自动同步待上传数据
- ✅ 失败自动重试（最多3次）
- ✅ 同步状态实时显示

### 3. 状态指示
- **在线/离线状态**：显示当前网络连接状态
- **WebSocket状态**：显示实时通信连接状态
- **同步状态**：显示数据同步进度和待同步数量

### 4. PWA 支持
- ✅ 可安装到手机主屏幕
- ✅ 离线访问
- ✅ Service Worker 缓存

## 技术实现

### 架构组件

1. **IndexedDB 存储** (`src/lib/db.ts`)
   - 本地数据库，存储比分和待同步队列
   - 支持离线数据持久化

2. **同步服务** (`src/lib/syncService.ts`)
   - 监听网络状态变化
   - 自动同步待上传数据
   - 重试机制

3. **PWA 配置** (`next.config.js` + `manifest.json`)
   - Service Worker 自动生成
   - 静态资源缓存
   - 离线访问支持

### 数据流程

```
用户计分 
  ↓
保存到 IndexedDB (本地)
  ↓
尝试立即同步到服务器
  ↓
如果失败 → 添加到待同步队列
  ↓
网络恢复时 → 自动同步队列中的数据
```

## 使用说明

### 正常使用
1. 打开场地管理页面
2. 正常计分，数据会实时保存
3. 顶部状态栏显示：
   - 🟢 **在线** - 网络正常，数据实时同步
   - 🟡 **离线** - 网络断开，数据保存到本地

### 离线场景
1. 当网络断开时，页面会显示橙色提示条：
   ```
   离线模式
   比分已保存到本地，网络恢复后将自动同步
   ```

2. 继续正常计分，所有数据都会保存到本地

3. 网络恢复后：
   - 自动同步所有待上传数据
   - 状态栏显示同步进度
   - 同步完成后提示消失

### 安装 PWA（可选）

#### 在 Android 手机上：
1. 使用 Chrome 浏览器打开应用
2. 点击浏览器菜单 → "添加到主屏幕"
3. 确认添加
4. 从主屏幕启动应用

#### 在 iOS 设备上：
1. 使用 Safari 浏览器打开应用
2. 点击分享按钮
3. 选择 "添加到主屏幕"
4. 确认添加

## 状态指示说明

### 网络状态
- 🟢 **在线** + WiFi 图标 - 网络连接正常
- 🟠 **离线** + WiFi关闭图标 - 网络断开，使用离线模式

### WebSocket 状态
- 🔵 **WS** - WebSocket 实时连接正常
- ⚪ **断开** - WebSocket 连接断开

### 同步状态
- 🔄 **同步中** - 正在同步数据到服务器
- ⚠️ **待同步 N** - 有 N 条数据等待同步
- ❌ **同步错误** - 同步失败（会自动重试）

## 开发部署

### 开发模式
```bash
cd apps/court-manager
pnpm dev
```

### 生产构建
```bash
cd apps/court-manager
pnpm build
pnpm start
```

### 环境变量
在 `.env.local` 中配置：
```env
NEXT_PUBLIC_API_URL=http://your-api-server:4001
NEXT_PUBLIC_WS_URL=http://your-api-server:4001
```

## 测试离线功能

### 方法 1：Chrome DevTools
1. 打开 Chrome DevTools (F12)
2. 切换到 "Network" 标签
3. 勾选 "Offline" 复选框
4. 测试计分功能

### 方法 2：实际断网
1. 关闭手机的 WiFi 和移动数据
2. 测试计分功能
3. 重新连接网络，观察自动同步

### 方法 3：Application 面板
1. 打开 Chrome DevTools
2. 切换到 "Application" 标签
3. 查看：
   - Service Workers - 查看 SW 状态
   - IndexedDB → CourtManagerDB - 查看本地数据
   - Manifest - 查看 PWA 配置

## 注意事项

1. **数据安全**
   - 本地数据存储在 IndexedDB，清除浏览器数据会丢失未同步数据
   - 建议在网络稳定时尽快完成同步

2. **浏览器支持**
   - Chrome/Edge/Safari/Firefox 现代版本都支持
   - 需要 HTTPS 才能启用 Service Worker（本地开发除外）

3. **同步机制**
   - 自动每5秒检查一次待同步数据
   - 失败会自动重试最多3次
   - 超过重试次数的数据会被丢弃并记录错误

4. **性能**
   - IndexedDB 操作是异步的，不会阻塞 UI
   - Service Worker 缓存可以加快页面加载速度

## 故障排除

### 问题：数据没有同步
1. 检查网络连接状态
2. 查看控制台错误信息
3. 检查 IndexedDB 中的 pendingSync 表

### 问题：离线模式不工作
1. 确认 Service Worker 已注册（DevTools → Application → Service Workers）
2. 清除缓存并重新加载
3. 检查浏览器是否支持 Service Worker

### 问题：PWA 无法安装
1. 确认使用 HTTPS（或 localhost）
2. 检查 manifest.json 配置
3. 确认至少有一个图标文件存在

## 更新日志

### v1.0.0 (2025-11)
- ✅ 实现 IndexedDB 本地存储
- ✅ 实现自动同步服务
- ✅ 添加网络状态监听
- ✅ 添加 PWA 支持
- ✅ 优化 UI 状态指示
