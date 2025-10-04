'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { Plus, Minus, RotateCcw, Settings, Trophy, Clock, Users } from 'lucide-react'

type Match = {
  id: number
  teamA: { id: number; name: string; players: string }
  teamB: { id: number; name: string; players: string }
  scoreA: number | null
  scoreB: number | null
  winnerId: number | null
  court: { id: number; name: string }
  matchType: string
  round: number
}

type ScoreHistory = {
  setNumber: number
  scoreA: number
  scoreB: number
  pointHistory: { scorer: 'A' | 'B', scoreA: number, scoreB: number }[]
}

type GameSettings = {
  maxSets: number // 几局几胜 (1, 3, 5)
  pointsPerSet: number // 每局多少分 (15, 21)
  deuceDiff: number // 平分后需要领先多少分获胜 (通常是2分)
  maxGamePoints: number // 每局最高分，防止无限加分 (如21分制通常设为30分)
}

const GAME_PRESETS = [
  { name: '一局15分制', maxSets: 1, pointsPerSet: 15, deuceDiff: 2, maxGamePoints: 21 },
  { name: '一局21分制', maxSets: 1, pointsPerSet: 21, deuceDiff: 2, maxGamePoints: 30 },
  { name:'一局31分制', maxSets: 1, pointsPerSet: 31, deuceDiff: 1, maxGamePoints: 31 },
  { name: '三局两胜15分制', maxSets: 3, pointsPerSet: 15, deuceDiff: 2, maxGamePoints: 21 },
  { name: '三局两胜21分制', maxSets: 3, pointsPerSet: 21, deuceDiff: 2, maxGamePoints: 30 },
  { name: '五局三胜11分制', maxSets: 5, pointsPerSet: 11, deuceDiff: 2, maxGamePoints: 15 },
]

// 获取队员名字组合显示
const getTeamDisplayName = (team: { name: string; players: string } | null | undefined): string => {
  if (!team) return '待定'
  
  // 优先显示队员名字组合
  if (team.players) {
    const players = team.players.split(/[,，、]/).map(p => p.trim()).filter(p => p)
    if (players.length >= 2) {
      return `${players[0]}/${players[1]}`
    } else if (players.length === 1) {
      return players[0]
    }
  }
  
  // 如果没有队员信息，fallback到队伍名称
  return team.name || '待定'
}

// 确定当前发球方（根据羽毛球规则：获得上一分的队伍发球，新局由上局获胜者开球）
const getCurrentServer = (scoreHistory: ScoreHistory[], gameSettings: GameSettings) => {
  if (!scoreHistory || scoreHistory.length === 0) return 'A'; // 第一局默认A队开始发球
  
  // 获取当前进行的局
  const currentSet = scoreHistory[scoreHistory.length - 1];
  const currentSetIndex = scoreHistory.length - 1;
  
  // 如果当前局有得分记录，返回最后得分者
  if (currentSet && currentSet.pointHistory && currentSet.pointHistory.length > 0) {
    const lastPoint = currentSet.pointHistory[currentSet.pointHistory.length - 1];
    return lastPoint.scorer; // 'A' 或 'B'
  }
  
  // 如果当前局没有得分记录（新局开始），查找上一局的获胜者
  if (currentSetIndex > 0) {
    const previousSet = scoreHistory[currentSetIndex - 1];
    if (previousSet) {
      const { pointsPerSet, deuceDiff } = gameSettings;
      
      // 判断上一局获胜者
      if (previousSet.scoreA >= pointsPerSet && previousSet.scoreA - previousSet.scoreB >= deuceDiff) {
        return 'A'; // A队获胜，A队开球
      } else if (previousSet.scoreB >= pointsPerSet && previousSet.scoreB - previousSet.scoreA >= deuceDiff) {
        return 'B'; // B队获胜，B队开球
      }
    }
  }
  
  // 默认情况（第一局或无法确定）
  return 'A';
};

export default function CourtManager() {
  const searchParams = useSearchParams()
  const courtId = parseInt(searchParams.get('courtId') || '1')
  
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [gameSettings, setGameSettings] = useState<GameSettings>(GAME_PRESETS[2]) // 默认三局两胜21分制
  const [showSettings, setShowSettings] = useState(false)
  
  // 比分历史记录
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([
    { setNumber: 1, scoreA: 0, scoreB: 0, pointHistory: [] }
  ])

  // 当前局数
  const currentSet = scoreHistory.length
  const currentSetData = scoreHistory[scoreHistory.length - 1]

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://100.74.143.98:4001'
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://100.74.143.98:4001'

  useEffect(() => {
    // 使用环境变量，确保在客户端也能正确获取

    
    console.log('连接地址:', WS_URL) // 添加日志确认地址
    
    // 建立WebSocket连接
    const newSocket = io(WS_URL)
    
    newSocket.on('connect', () => {
      setIsConnected(true)
      newSocket.emit('join-room', `court-${courtId}`)
      console.log('Connected to server')
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
      console.log('Disconnected from server')
    })

    // 监听比分更新
    newSocket.on('score-updated', (data) => {
      if (data.courtId === courtId) {
        setCurrentMatch(data.match)
        
        // 更新比分历史
        if (data.scoreHistory) {
          setScoreHistory(data.scoreHistory);
        }
        
        // 更新游戏设置
        if (data.gameSettings) {
          setGameSettings(data.gameSettings);
        }
      }
    })

    // 监听比赛分配
    newSocket.on('match-assigned', (data) => {
      if (data.courtId === courtId) {
        setCurrentMatch(data.match)
        // 只有在新比赛没有比分历史时才重置
        if (!data.match.scoreHistory) {
          setScoreHistory([{ setNumber: 1, scoreA: 0, scoreB: 0, pointHistory: [] }])
        }
      }
    })

    setSocket(newSocket)
    
    // 获取当前比赛
    fetchCurrentMatch()

    return () => {
      newSocket.disconnect()
    }
  }, [courtId])

  const fetchCurrentMatch = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/courts/${courtId}/current-match`)
      if (response.ok) {
        const match = await response.json()
        setCurrentMatch(match)
        
        // 恢复比分历史和游戏设置
        if (match && match.scoreHistory) {
          try {
            const savedScoreHistory = JSON.parse(match.scoreHistory);
            setScoreHistory(savedScoreHistory);
          } catch (e) {
            console.error('Failed to parse score history:', e);
            // 如果有总比分但没有详细历史，尝试重构
            if (match.scoreA !== null && match.scoreB !== null) {
              setScoreHistory([{ 
                setNumber: 1, 
                scoreA: match.scoreA, 
                scoreB: match.scoreB, 
                pointHistory: [] 
              }]);
            }
          }
        } else if (match && match.scoreA !== null && match.scoreB !== null) {
          // 从总比分重构比分历史
          setScoreHistory([{ 
            setNumber: 1, 
            scoreA: match.scoreA, 
            scoreB: match.scoreB, 
            pointHistory: [] 
          }]);
        }
        
        // 恢复游戏设置
        if (match && match.gameSettings) {
          try {
            const savedGameSettings = JSON.parse(match.gameSettings);
            setGameSettings(savedGameSettings);
          } catch (e) {
            console.error('Failed to parse game settings:', e);
          }
        }
      }
    } catch (error) {
      console.error('获取比赛数据失败:', error)
    }
  }

  // 计算当前总比分
  const totalScore = useMemo(() => {
    let setsWonA = 0, setsWonB = 0
    let totalPointsA = 0, totalPointsB = 0

    scoreHistory.forEach(set => {
      totalPointsA += set.scoreA
      totalPointsB += set.scoreB
      
      // 判断这一局的获胜者
      const { pointsPerSet, deuceDiff, maxGamePoints } = gameSettings
      if (set.scoreA >= pointsPerSet && set.scoreA - set.scoreB >= deuceDiff || (set.scoreA >= maxGamePoints && maxGamePoints > 0)) {
        setsWonA++
      } else if (set.scoreB >= pointsPerSet && set.scoreB - set.scoreA >= deuceDiff || (set.scoreB >= maxGamePoints && maxGamePoints > 0)) {
        setsWonB++
      }
    })

    return { setsWonA, setsWonB, totalPointsA, totalPointsB }
  }, [scoreHistory, gameSettings])

  // 判断比赛是否结束
  const isMatchFinished = useMemo(() => {
    const neededSets = Math.ceil(gameSettings.maxSets / 2)
    return totalScore.setsWonA >= neededSets || totalScore.setsWonB >= neededSets
  }, [totalScore, gameSettings])

  // 保存比分到数据库
  const saveScoreToDatabase = async () => {
    if (!currentMatch) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/matches/${currentMatch.id}/score`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scoreA: totalScore.totalPointsA,
          scoreB: totalScore.totalPointsB,
          scoreHistory: scoreHistory,
          gameSettings: gameSettings,
        }),
      });

      if (!response.ok) {
        console.error('Failed to save score to database');
      }
    } catch (error) {
      console.error('Error saving score:', error);
    }
  };

  // 加分函数
  const addPoint = (team: 'A' | 'B') => {
    if (isMatchFinished) return

    const newHistory = [...scoreHistory]
    const currentSetIndex = newHistory.length - 1
    const currentSet = { ...newHistory[currentSetIndex] }

    // 记录得分
    if (team === 'A') {
      currentSet.scoreA++
    } else {
      currentSet.scoreB++
    }

    // 记录得分历史
    currentSet.pointHistory.push({
      scorer: team,
      scoreA: currentSet.scoreA,
      scoreB: currentSet.scoreB
    })

    newHistory[currentSetIndex] = currentSet

    // 检查是否需要开始新一局
    const { pointsPerSet, deuceDiff } = gameSettings
    const isSetFinished = 
      (currentSet.scoreA >= pointsPerSet && currentSet.scoreA - currentSet.scoreB >= deuceDiff) ||
      (currentSet.scoreB >= pointsPerSet && currentSet.scoreB - currentSet.scoreA >= deuceDiff)

    if (isSetFinished && newHistory.length < gameSettings.maxSets) {
      // 检查比赛是否真的结束
      let setsWonA = 0, setsWonB = 0
      newHistory.forEach(set => {
        if (set.scoreA >= pointsPerSet && set.scoreA - set.scoreB >= deuceDiff) setsWonA++
        else if (set.scoreB >= pointsPerSet && set.scoreB - set.scoreA >= deuceDiff) setsWonB++
      })

      const neededSets = Math.ceil(gameSettings.maxSets / 2)
      if (setsWonA < neededSets && setsWonB < neededSets) {
        // 开始新一局
        newHistory.push({
          setNumber: newHistory.length + 1,
          scoreA: 0,
          scoreB: 0,
          pointHistory: []
        })
      }
    }

    setScoreHistory(newHistory)
  }

  // 监听比分变化并自动保存到数据库
  useEffect(() => {
    if (currentMatch && scoreHistory.length > 0) {
      // 延迟保存以避免频繁请求
      const saveTimer = setTimeout(() => {
        saveScoreToDatabase();
      }, 500);

      // 自动滑动到最新得分
      const scrollTimer = setTimeout(() => {
        const scrollElements = document.querySelectorAll('[data-scroll-container]');
        scrollElements.forEach(el => {
          if (el) {
            el.scrollLeft = el.scrollWidth - el.clientWidth;
          }
        });
      }, 200);

      return () => {
        clearTimeout(saveTimer);
        clearTimeout(scrollTimer);
      };
    }
  }, [scoreHistory, gameSettings, currentMatch]);

  // 撤销上一个得分
  const undoLastPoint = () => {
    const newHistory = [...scoreHistory]
    let currentSetIndex = newHistory.length - 1
    let currentSet = { ...newHistory[currentSetIndex] }

    if (currentSet.pointHistory.length === 0) {
      // 当前局没有得分记录，检查上一局
      if (currentSetIndex > 0) {
        newHistory.pop() // 删除当前空局
        currentSetIndex--
        currentSet = { ...newHistory[currentSetIndex] }
      } else {
        return // 没有可撤销的得分
      }
    }

    // 撤销最后一个得分
    if (currentSet.pointHistory.length > 0) {
      currentSet.pointHistory.pop()
      
      if (currentSet.pointHistory.length > 0) {
        const lastPoint = currentSet.pointHistory[currentSet.pointHistory.length - 1]
        currentSet.scoreA = lastPoint.scoreA
        currentSet.scoreB = lastPoint.scoreB
      } else {
        currentSet.scoreA = 0
        currentSet.scoreB = 0
      }

      newHistory[currentSetIndex] = currentSet
      setScoreHistory(newHistory)
    }
  }

  // 重置比赛
  const resetMatch = () => {
    setScoreHistory([{ setNumber: 1, scoreA: 0, scoreB: 0, pointHistory: [] }])
  }

  if (!currentMatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center p-4">
        <div className="text-center">
          <Clock className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-gray-400" />
          <h1 className="text-xl md:text-2xl font-bold mb-2">场地 {courtId}</h1>
          <p className="text-gray-400">暂无比赛分配</p>
          <div className="mt-4">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm ${
              isConnected ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              {isConnected ? '已连接' : '连接中...'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="max-w-4xl mx-auto px-3 py-3">
        
        {/* 标题栏 - 超紧凑响应式 */}
        <header className="mb-3">
          <div className="text-center md:flex md:items-center md:justify-between">
            <div className="mb-2 md:mb-0">
              <h1 className="text-lg md:text-xl font-bold text-amber-300">{currentMatch.court.name}</h1>
              <p className="text-gray-400 text-xs">
                {currentMatch.matchType} - 第{currentMatch.round}轮
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${
                isConnected ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
              }`}>
                <div className={`w-1 h-1 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                {isConnected ? '已连接' : '连接中...'}
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>
          </div>
        </header>

        {/* 设置面板 - 超紧凑响应式 */}
        {showSettings && (
          <div className="bg-slate-800/70 rounded-lg p-2 mb-3 border border-gray-600/50">
            <h3 className="text-sm font-bold mb-2 text-gray-200">比赛设置</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
              {GAME_PRESETS.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setGameSettings(preset)
                    setShowSettings(false)
                    resetMatch()
                  }}
                  className={`p-1.5 rounded-md border transition-colors text-xs ${
                    JSON.stringify(gameSettings) === JSON.stringify(preset)
                      ? 'border-blue-400/50 bg-blue-600/20 text-blue-300'
                      : 'border-gray-600/50 bg-slate-700/50 hover:border-gray-500/50'
                  }`}
                >
                  <div className="font-medium">{preset.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {preset.maxSets}局{preset.pointsPerSet}分
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 主比分显示 - 超紧凑响应式布局 */}
        <div className="mb-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-4">
            
            {/* 队伍A */}
            <div className="bg-slate-700 border border-blue-400/30 rounded-lg p-3 text-white min-h-[140px] flex flex-col justify-between">
              <div className="flex-1">
                {/* 队名和发球指示 */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h2 className="text-base font-bold break-words text-center">
                    {getTeamDisplayName(currentMatch.teamA)}
                  </h2>
                  {getCurrentServer(scoreHistory, gameSettings) === 'A' && (
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full"></span>
                  )}
                </div>
                
                {/* 局数和当前局得分左右排布 */}
                <div className="flex items-center justify-between mb-2">
                  {/* 赢得局数 */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-300">{totalScore.setsWonA}</div>
                    <div className="text-xs text-gray-400">局</div>
                  </div>
                  
                  {/* 当前局得分 */}
                  <div className="bg-slate-600/70 rounded-md px-3 py-1">
                    <div className="text-xl font-bold text-blue-200">{currentSetData.scoreA}</div>
                  </div>
                </div>
              </div>
              
              {/* 加分按钮 */}
              <button
                onClick={() => addPoint('A')}
                disabled={isMatchFinished}
                className="w-full h-10 bg-green-700/80 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-base transition-colors"
              >
                +1
              </button>
            </div>

            {/* 队伍B */}
            <div className="bg-slate-700 border border-red-400/30 rounded-lg p-3 text-white min-h-[140px] flex flex-col justify-between">
              <div className="flex-1">
                {/* 队名和发球指示 */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h2 className="text-base font-bold break-words text-center">
                    {getTeamDisplayName(currentMatch.teamB)}
                  </h2>
                  {getCurrentServer(scoreHistory, gameSettings) === 'B' && (
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full"></span>
                  )}
                </div>
                
                {/* 局数和当前局得分左右排布 */}
                <div className="flex items-center justify-between mb-2">
                  {/* 赢得局数 */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-300">{totalScore.setsWonB}</div>
                    <div className="text-xs text-gray-400">局</div>
                  </div>
                  
                  {/* 当前局得分 */}
                  <div className="bg-slate-600/70 rounded-md px-3 py-1">
                    <div className="text-xl font-bold text-red-200">{currentSetData.scoreB}</div>
                  </div>
                </div>
              </div>
              
              {/* 加分按钮 */}
              <button
                onClick={() => addPoint('B')}
                disabled={isMatchFinished}
                className="w-full h-10 bg-green-700/80 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-base transition-colors"
              >
                +1
              </button>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <button
              onClick={undoLastPoint}
              className="px-3 py-1.5 bg-amber-700/80 hover:bg-amber-600 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm"
            >
              <RotateCcw className="w-3 h-3" />
              撤销
            </button>
            <button
              onClick={resetMatch}
              className="px-3 py-1.5 bg-red-800/80 hover:bg-red-700 rounded-lg font-medium transition-colors text-sm"
            >
              重置比赛
            </button>
          </div>

          {/* 比赛状态 */}
          {isMatchFinished && (
            <div className="mt-3 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-700/80 rounded-lg font-bold text-amber-100 text-sm">
                <Trophy className="w-4 h-4" />
                获胜: {totalScore.setsWonA > totalScore.setsWonB ? getTeamDisplayName(currentMatch.teamA) : getTeamDisplayName(currentMatch.teamB)}
              </div>
            </div>
          )}
        </div>

        {/* 比分历史表格 - 超紧凑统一表格视图 */}
        <div className="bg-slate-800/70 rounded-lg p-2 border border-gray-600/50">
          <h3 className="text-sm font-bold mb-2 flex items-center gap-2 text-gray-200">
            <Users className="w-3 h-3" />
            得分历史
          </h3>
          
          {/* 统一的表格视图 */}
          <div className="space-y-2">
            {scoreHistory.map((set, setIndex) => (
              <div key={setIndex} className="bg-slate-700/50 rounded-md p-2">
                <div className="text-xs font-medium text-gray-300 mb-1">
                  第 {set.setNumber} 局 ({set.scoreA} - {set.scoreB})
                </div>
                
                {set.pointHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <div 
                      className="flex gap-1 min-w-full pb-1"
                      data-scroll-container
                      style={{
                        scrollBehavior: 'smooth',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#64748b #334155'
                      }}
                    >
                      {/* 队伍名称列 */}
                      <div className="flex-shrink-0 w-10 text-xs text-gray-400 mr-1">
                        <div className="h-3 flex items-center justify-center border-b border-gray-600/50 text-xs">轮</div>
                        <div className="h-3 flex items-center justify-center text-blue-300 bg-blue-600/10 border-b border-gray-600/50 text-xs">{getTeamDisplayName(currentMatch.teamA).slice(0, 3)}</div>
                        <div className="h-3 flex items-center justify-center text-red-300 bg-red-600/10 text-xs">{getTeamDisplayName(currentMatch.teamB).slice(0, 3)}</div>
                      </div>
                      
                      {/* 得分列 */}
                      {set.pointHistory.map((point, pointIndex) => (
                        <div key={pointIndex} className={`
                          flex-shrink-0 w-5 text-xs text-center border-l border-gray-600/50
                          ${pointIndex === set.pointHistory.length - 1 ? 'bg-amber-600/30 border-amber-500/50 shadow-lg' : ''}
                        `}>
                          <div className="h-3 flex items-center justify-center text-gray-400 border-b border-gray-600/50 text-xs">
                            {pointIndex + 1}
                          </div>
                          <div className={`h-3 flex items-center justify-center font-bold text-xs border-b border-gray-600/50 ${
                            point.scorer === 'A' ? 'text-blue-300 bg-blue-600/20' : 'text-gray-500'
                          }`}>
                            {point.scoreA}
                          </div>
                          <div className={`h-3 flex items-center justify-center font-bold text-xs ${
                            point.scorer === 'B' ? 'text-red-300 bg-red-600/20' : 'text-gray-500'
                          }`}>
                            {point.scoreB}
                          </div>
                        </div>
                      ))}
                      
                      {/* 当前发球方指示器 */}
                      <div className="flex-shrink-0 w-6 text-xs text-center">
                        <div className="h-3 flex items-center justify-center text-gray-400 border-b border-gray-600/50 text-xs">
                          球
                        </div>
                        <div className={`h-3 flex items-center justify-center border-b border-gray-600/50 text-xs ${
                          getCurrentServer(scoreHistory, gameSettings) === 'A' ? 'text-green-400' : 'text-gray-600'
                        }`}>
                          {getCurrentServer(scoreHistory, gameSettings) === 'A' ? '●' : '○'}
                        </div>
                        <div className={`h-3 flex items-center justify-center text-xs ${
                          getCurrentServer(scoreHistory, gameSettings) === 'B' ? 'text-green-400' : 'text-gray-600'
                        }`}>
                          {getCurrentServer(scoreHistory, gameSettings) === 'B' ? '●' : '○'}
                        </div>
                      </div>
                      
                      {/* 空白填充区域 */}
                      <div className="flex-shrink-0 w-3"></div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 text-center py-1">
                    暂无得分记录
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}