# 赛程生成重构说明

## 重构日期
2025年10月2日

## 问题描述
- `schedule.ts` 中存在逻辑不正确的赛程生成函数
- 与 `index.ts` 中的正确赛程生成逻辑重复和冲突
- 轮空处理不当，存在队伍自己对战自己的bug

## 解决方案

### 1. 清理 `schedule.ts`
**删除的函数：**
- `generateTournament()` - 逻辑简单且有bug
- `generateTournamentWithSeeds()` - 未使用且逻辑复杂

**保留的函数：**
- `clearTournament()` - 被 `index.ts` 使用
- `buildMatchQueue()` - 可能有用的工具函数

### 2. 更新 `routes/match.ts`
- 移除对已删除函数的导入
- 将 `POST /generate` 路由标记为废弃，返回410状态码
- 指导用户使用正确的API端点

### 3. 推荐的API使用

**生成赛程：**
```
POST /api/schedule/generate-bracket
```
这个API提供完整的单淘汰赛功能，包括：
- 正确的轮空处理
- 完整的锦标赛树结构
- Tournament 和 TournamentRound 表管理

**清空赛程：**
```
POST /api/schedule/clear-bracket
```

## 影响
- 移除了有问题的赛程生成逻辑
- 保持了现有功能的完整性
- 代码更加清晰和一致
- 避免了API使用上的混淆

## 注意事项
- 如果有前端代码使用了 `POST /api/matches/generate`，需要更新为使用 `POST /api/schedule/generate-bracket`
- 旧的路由会返回410错误，指导用户使用新的API