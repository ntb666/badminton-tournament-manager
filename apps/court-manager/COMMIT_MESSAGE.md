# Git Commit Message

## 标题
feat(court-manager): 实现PWA离线计分功能，解决网络波动导致的数据丢失问题

## 详细描述

### 问题
- 手机移动端因网络波动导致比分无法同步到服务器
- 出现比分回退的不良现象
- 数据可能丢失

### 解决方案
实现完整的PWA（渐进式Web应用）离线计分功能：

1. **IndexedDB本地存储**
   - 所有比分立即保存到本地数据库
   - 数据永不丢失，永不回退

2. **智能同步服务**
   - 网络正常时立即同步到服务器
   - 网络异常时加入待同步队列
   - 网络恢复后自动同步
   - 失败自动重试（最多3次）

3. **实时状态指示**
   - 在线/离线网络状态
   - WebSocket连接状态
   - 同步进度和待同步数量

4. **PWA支持**
   - Service Worker离线缓存
   - 可安装到主屏幕
   - 完整的离线体验

### 技术栈
- next-pwa: PWA支持
- IndexedDB: 本地数据存储
- Service Worker: 离线缓存
- 自定义同步服务: 自动数据同步

### 新增文件
- src/lib/db.ts - IndexedDB数据库管理
- src/lib/syncService.ts - 同步服务
- public/manifest.json - PWA配置
- public/icon-*.svg - 应用图标
- PWA_OFFLINE_GUIDE.md - 功能使用指南
- TESTING_GUIDE.md - 测试指南
- PWA_IMPLEMENTATION_SUMMARY.md - 实现总结
- QUICKSTART.md - 快速开始

### 修改文件
- package.json - 添加next-pwa依赖
- next.config.js - 配置PWA
- src/app/layout.tsx - 添加PWA meta标签
- src/app/page.tsx - 集成离线功能和状态指示

### Breaking Changes
无

### 测试
- ✅ 正常在线计分
- ✅ 离线计分功能
- ✅ 网络恢复自动同步
- ✅ 网络波动场景
- ✅ PWA安装

### 文档
提供完整的使用和测试文档

---

Co-authored-by: GitHub Copilot
