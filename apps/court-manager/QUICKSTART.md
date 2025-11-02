# 🚀 Court Manager PWA - 快速开始

## 一分钟了解

Court Manager 现已支持 **PWA 离线计分**功能！

**核心优势**:
- ✅ 即使断网也能正常计分
- ✅ 比分永不丢失，永不回退
- ✅ 网络恢复后自动同步
- ✅ 可安装到手机主屏幕

## 快速开始

### 1. 安装依赖（已完成）
```bash
cd apps/court-manager
pnpm install
```

### 2. 启动开发服务器
```bash
pnpm dev
```

### 3. 打开浏览器
访问: http://localhost:3001?courtId=1

### 4. 测试离线功能
1. 打开 Chrome DevTools (F12)
2. 切换到 Network 标签
3. 勾选 "Offline" 复选框
4. 尝试点击 "+1" 加分
5. 取消勾选 "Offline"
6. 观察数据自动同步 ✨

## 状态指示器说明

页面顶部有三个状态指示器：

| 图标 | 含义 |
|------|------|
| 🟢 在线 + WiFi | 网络连接正常，实时同步 |
| 🟠 离线 + WiFi关闭 | 网络断开，数据保存到本地 |
| 🔵 WS | WebSocket 实时连接正常 |
| ⚪ 断开 | WebSocket 连接断开 |
| 🔄 同步中 | 正在同步数据到服务器 |
| ⚠️ 待同步 N | 有 N 条数据等待同步 |

## 离线模式提示

当网络断开时，会显示橙色提示条：
```
🔌 离线模式
比分已保存到本地，网络恢复后将自动同步
```

## 生产部署

### 构建
```bash
pnpm build
```

### 启动
```bash
pnpm start
```

### 环境变量
创建 `.env.local` 文件：
```env
NEXT_PUBLIC_API_URL=http://your-server:4001
NEXT_PUBLIC_WS_URL=http://your-server:4001
```

## 查看本地数据

1. 打开 Chrome DevTools (F12)
2. 切换到 Application 标签
3. 左侧菜单: Storage → IndexedDB → CourtManagerDB
4. 查看两个表：
   - **scores**: 所有保存的比分数据
   - **pendingSync**: 等待同步的数据

## 故障排除

### 问题：数据没有保存
**解决**:
1. 检查浏览器是否支持 IndexedDB
2. 查看控制台错误信息
3. 清空浏览器缓存重试

### 问题：网络恢复后没有同步
**解决**:
1. 确认 API 服务器正在运行
2. 检查 `NEXT_PUBLIC_API_URL` 配置
3. 查看控制台同步日志

### 问题：PWA 无法安装
**解决**:
1. 生产环境必须使用 HTTPS
2. 确认 manifest.json 正确加载
3. 检查 Service Worker 注册状态

## 更多文档

- 📖 **完整功能说明**: `PWA_OFFLINE_GUIDE.md`
- 🧪 **详细测试指南**: `TESTING_GUIDE.md`
- 📝 **实现总结**: `PWA_IMPLEMENTATION_SUMMARY.md`

## 技术支持

如遇问题，请查看：
1. 浏览器控制台日志
2. IndexedDB 数据状态
3. Service Worker 注册状态
4. 网络请求详情

---

**享受无忧的离线计分体验！** 🎉
