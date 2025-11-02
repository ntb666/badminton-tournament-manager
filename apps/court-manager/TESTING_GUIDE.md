# Court Manager PWA 离线功能测试指南

## 前置准备

1. 启动 API 服务器（如果需要测试在线同步）
```bash
cd apps/api
pnpm dev
```

2. 启动 Court Manager
```bash
cd apps/court-manager
pnpm dev
```

3. 在浏览器中打开 http://localhost:3001?courtId=1

## 测试场景

### 场景 1: 正常在线计分
**预期行为**: 比分实时同步到服务器

1. 打开应用，确认顶部显示 "在线" + WiFi 图标
2. 点击 "+1" 按钮为队伍 A 加分
3. 打开浏览器 DevTools → Application → IndexedDB → CourtManagerDB
4. 查看 `scores` 表中的数据
5. 查看 `pendingSync` 表应该为空（数据已立即同步）

### 场景 2: 离线计分
**预期行为**: 数据保存到本地，显示离线提示

1. 打开 Chrome DevTools (F12)
2. 切换到 Network 标签，勾选 "Offline"
3. 观察顶部状态栏变为 "离线" + WiFi关闭图标
4. 观察页面显示橙色离线提示条
5. 继续点击 "+1" 按钮加分
6. 查看 IndexedDB：
   - `scores` 表中有新数据，`synced: false`
   - `pendingSync` 表中有待同步记录

### 场景 3: 网络恢复自动同步
**预期行为**: 自动同步所有待上传数据

1. 在离线状态下加几个分
2. 取消勾选 DevTools 的 "Offline"
3. 观察顶部出现同步状态指示器（旋转图标）
4. 几秒后同步完成
5. 查看 `pendingSync` 表应该清空
6. 橙色离线提示消失

### 场景 4: 网络波动
**预期行为**: 数据不会丢失或回退

1. 正常在线状态下加分
2. 快速切换 "Offline" 和 "Online" 多次
3. 继续加分
4. 观察比分不会回退
5. 最终所有数据都能正确同步

### 场景 5: PWA 安装
**预期行为**: 可以安装到主屏幕

1. 在 Chrome 中打开应用
2. 地址栏右侧应出现 "安装" 图标
3. 点击安装
4. 从桌面/应用列表启动 PWA 版本
5. 测试离线功能

## 检查点

### ✅ 功能检查
- [ ] 离线状态下能正常计分
- [ ] 离线提示正确显示
- [ ] 网络状态指示器正确
- [ ] 同步状态指示器正确
- [ ] 待同步数量显示正确
- [ ] 网络恢复后自动同步
- [ ] 同步失败会重试
- [ ] 数据不会丢失或回退

### ✅ IndexedDB 检查
- [ ] `scores` 表正确存储数据
- [ ] `pendingSync` 表在离线时有数据
- [ ] 同步成功后 `pendingSync` 清空
- [ ] 数据结构完整（包含 scoreHistory 和 gameSettings）

### ✅ Service Worker 检查
1. 打开 DevTools → Application → Service Workers
2. 确认 Service Worker 已注册和激活
3. 状态应该是 "activated and is running"

### ✅ Manifest 检查
1. 打开 DevTools → Application → Manifest
2. 确认所有字段正确显示
3. 图标正确加载

## 调试技巧

### 查看控制台日志
重要的日志信息：
- `Score saved to local DB` - 数据已保存到本地
- `Score synced to server immediately` - 立即同步成功
- `Offline, adding to sync queue` - 离线状态，添加到队列
- `Network restored, triggering sync` - 网络恢复，触发同步
- `Synced item X successfully` - 某项数据同步成功

### 清理测试数据
在 DevTools Console 中执行：
```javascript
// 清空 IndexedDB
indexedDB.deleteDatabase('CourtManagerDB')

// 重新加载页面
location.reload()
```

### 模拟慢速网络
1. DevTools → Network → Throttling
2. 选择 "Slow 3G" 或自定义
3. 测试同步重试机制

### 检查 PWA 缓存
1. DevTools → Application → Cache Storage
2. 查看 `workbox-precache` 缓存的文件
3. 查看 `api-cache` 缓存的 API 响应

## 常见问题

### Q: 离线状态下加分后，数据没有保存？
A: 检查浏览器控制台是否有错误。IndexedDB 需要浏览器支持，确保使用现代浏览器。

### Q: 网络恢复后数据没有自动同步？
A: 检查：
1. 控制台是否有 "Network restored" 日志
2. `navigator.onLine` 是否返回 true
3. SyncService 是否正常启动

### Q: 同步一直失败？
A: 检查：
1. API 服务器是否正常运行
2. API_BASE_URL 配置是否正确
3. 控制台错误信息

### Q: PWA 无法安装？
A: 检查：
1. 是否使用 HTTPS（本地开发除外）
2. manifest.json 是否正确加载
3. Service Worker 是否成功注册

## 性能测试

### 大量数据测试
1. 离线状态下快速点击加分 50 次
2. 观察界面是否流畅
3. 网络恢复后是否能正确同步所有数据

### 长时间离线测试
1. 离线状态下完成一整场比赛
2. 保持离线 10 分钟
3. 恢复网络，观察是否正确同步

## 报告问题

如果发现问题，请记录：
1. 复现步骤
2. 浏览器版本和类型
3. 控制台错误信息
4. IndexedDB 数据快照
5. 网络状态和时间点
