# 羽毛球赛事管理系统 - 业务流程API

## 完整业务流程

### 1. 导入报名表
```http
POST /api/teams/import
Content-Type: multipart/form-data

Form Data:
- file: CSV文件
```

### 2. 生成赛程树
为每个赛项（男双、女双、混双等）分别生成赛程：

```http
POST /api/schedule/generate-bracket
Content-Type: application/json

{
  "matchType": "MEN_DOUBLE" | "WOMEN_DOUBLE" | "MIX_DOUBLE",
  "seedPlayers": {} // 可选的种子选手设置
}
```

**功能：**
- 创建 Tournament 记录
- 创建 TournamentRound 记录
- 创建 Match 记录（状态为 'scheduled' 或 'pending'）
- 构建完整的淘汰赛树结构
- **不会自动分配场地**

### 3. 形成比赛队列
查看当前待分配的比赛队列：

```http
GET /api/matches/pending
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "queuePosition": 1,
      "queueLabel": "#1",
      "teamA": "队伍A",
      "teamB": "队伍B",
      "matchType": "MEN_DOUBLE",
      "round": 1
    }
  ]
}
```

### 4. 为场地分配比赛 ⭐ 新增功能
手动触发场地分配（不再是自动的）：

#### 4.1 自动批量分配
```http
POST /api/matches/assign-to-courts
Content-Type: application/json

{
  "autoAssign": true
}
```

#### 4.2 手动指定分配
```http
POST /api/matches/assign-to-courts
Content-Type: application/json

{
  "autoAssign": false,
  "assignments": [
    { "matchId": 1, "courtId": 1 },
    { "matchId": 2, "courtId": 2 }
  ]
}
```

#### 4.3 单场比赛分配到场地
```http
POST /api/courts/:courtId/assign-next-match
```

### 5. 后续比赛管理

#### 5.1 开始比赛
```http
POST /api/matches/:matchId/start
```

#### 5.2 更新比分
```http
POST /api/matches/:matchId/score
Content-Type: application/json

{
  "scoreA": 1,
  "scoreB": 0,
  "gameDetails": {...}
}
```

#### 5.3 结束比赛
```http
POST /api/matches/:matchId/finish
Content-Type: application/json

{
  "winnerId": 123
}
```

## 重要变更说明

### ❌ 已禁用的自动功能
- **自动场地分配定时器**：之前每5秒自动分配比赛到场地的功能已禁用
- 现在场地分配需要手动触发

### ✅ 新增的手动控制
- 新增 `POST /api/matches/assign-to-courts` API
- 支持自动分配和手动指定两种模式
- 更符合实际赛事管理的业务流程

### 🔧 前端集成建议
1. 在赛程管理界面添加"分配场地"按钮
2. 提供批量自动分配和手动分配两种选项
3. 显示当前待分配队列状态
4. 实时更新场地状态

## WebSocket 事件
- `scheduleUpdate`: 赛程生成/清空通知
- `bulk-matches-assigned`: 批量场地分配完成通知
- `court-status-update`: 场地状态更新通知
- `pending-matches-update`: 待分配队列更新通知