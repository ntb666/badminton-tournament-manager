'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Users, Clock, Activity, RefreshCw, Zap } from 'lucide-react';
import io from 'socket.io-client';

// 类型定义
interface Court {
  id: number;
  name: string;
  match?: {
    id: number;
    teamA: string;
    teamB: string;
    scoreA: number | null;
    scoreB: number | null;
    status: string;
    scoreHistory?: string;
    gameSettings?: string;
  } | null;
  status?: 'available' | 'occupied';
}

interface Match {
  id: string;
  teamA: string | null;
  teamB: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  status: 'pending' | 'playing' | 'completed';
  scoreHistory?: string;
  gameSettings?: string;
}

interface PendingMatch {
  id: number;
  teamA: string;
  teamB: string;
  matchType: string;
  round: number;
}

interface Statistics {
  total: number;
  completed: number;
  active: number;
  waiting: number;
}

interface Round {
  round: number;
  roundName: string;
  matches: Match[];
}

interface Tournament {
  id: string;
  matchType: string;
  totalTeams: number;
  rounds: Round[];
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [schedule, setSchedule] = useState<Tournament[]>([]);
  const [socket, setSocket] = useState<any>(null);
  const [activeTournament, setActiveTournament] = useState<number>(0);
  const [statistics, setStatistics] = useState<Statistics>({
    total: 0,
    completed: 0,
    active: 0,
    waiting: 0
  });
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);

  // 格式化比分显示
  const formatScore = (match: any) => {
    if (!match.scoreHistory) {
      return {
        scoreA: match.scoreA ?? '-',
        scoreB: match.scoreB ?? '-',
        sets: []
      };
    }

    try {
      const scoreHistory = JSON.parse(match.scoreHistory);
      const gameSettings = match.gameSettings ? JSON.parse(match.gameSettings) : { pointsPerSet: 21, deuceDiff: 2 };
      
      let setsWonA = 0;
      let setsWonB = 0;
      const sets = scoreHistory.map((set: any) => {
        const pointsPerSet = gameSettings.pointsPerSet || 21;
        const deuceDiff = gameSettings.deuceDiff || 2;
        
        const setWinnerA = set.scoreA >= pointsPerSet && set.scoreA - set.scoreB >= deuceDiff;
        const setWinnerB = set.scoreB >= pointsPerSet && set.scoreB - set.scoreA >= deuceDiff;
        
        if (setWinnerA) setsWonA++;
        if (setWinnerB) setsWonB++;
        
        return {
          scoreA: set.scoreA,
          scoreB: set.scoreB,
          winnerA: setWinnerA,
          winnerB: setWinnerB
        };
      });

      return {
        scoreA: setsWonA,
        scoreB: setsWonB,
        sets: sets
      };
    } catch (error) {
      return {
        scoreA: match.scoreA ?? '-',
        scoreB: match.scoreB ?? '-',
        sets: []
      };
    }
  };

  // 确保组件已挂载到客户端
  useEffect(() => {
    setMounted(true);
  }, []);

  const openCourtManager = (courtId: number) => {
    window.open(`http://localhost:3001?courtId=${courtId}`, '_blank', 'width=1200,height=800');
  };

  const fetchStatistics = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/statistics');
      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
  };

  const fetchPendingMatches = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/matches/pending');
      const data = await response.json();
      setPendingMatches(data);
    } catch (error) {
      console.error('Failed to fetch pending matches:', error);
    }
  };

  const fetchCourts = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/courts/status');
      const data = await response.json();
      setCourts(data);
    } catch (error) {
      console.error('Failed to fetch courts:', error);
    }
  };

  const fetchSchedule = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/schedule/tree');
      const data = await response.json();
      setSchedule(data);
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    }
  };

  const assignMatchToCourt = async (matchId: number, courtId: number) => {
    try {
      const response = await fetch(`http://localhost:4000/api/matches/${matchId}/assign-court`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ courtId }),
      });
      
      if (response.ok) {
        fetchCourts();
        fetchPendingMatches();
        fetchStatistics();
        setShowAssignModal(false);
      }
    } catch (error) {
      console.error('Failed to assign match:', error);
    }
  };

  const assignNextMatch = async (courtId: number) => {
    try {
      const response = await fetch(`http://localhost:4000/api/courts/${courtId}/assign-next-match`, {
        method: 'POST',
      });
      
      if (response.ok) {
        fetchCourts();
        fetchPendingMatches();
        fetchStatistics();
      }
    } catch (error) {
      console.error('Failed to assign next match:', error);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchCourts();
      fetchSchedule();
      fetchStatistics();
      fetchPendingMatches();
    }
  }, [mounted]);

  useEffect(() => {
    // 连接到后端Socket.IO
    const newSocket = io('http://localhost:4000');
    setSocket(newSocket);

    // 监听Socket事件
    newSocket.on('score-updated', (data: any) => {
      console.log('Score updated via WebSocket:', data);
      fetchCourts();
      fetchSchedule();
      fetchStatistics();
    });

    newSocket.on('match-completed', (data: any) => {
      console.log('Match completed via WebSocket:', data);
      fetchCourts();
      fetchSchedule();
      fetchStatistics();
    });

    newSocket.on('match-assigned', (data: any) => {
      console.log('Match assigned via WebSocket:', data);
      fetchCourts();
      fetchPendingMatches();
      fetchStatistics();
    });

    newSocket.on('match-created', (data: any) => {
      console.log('New match created via WebSocket:', data);
      fetchSchedule();
      fetchPendingMatches();
      fetchStatistics();
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20" suppressHydrationWarning>
      {/* 顶部导航栏 */}
      <nav className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Trophy className="h-5 w-5 text-white" suppressHydrationWarning />
              </div>
              <h1 className="text-xl font-semibold text-white">羽毛球赛事管理 - 现代版</h1>
            </div>
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/20 rounded-full border border-emerald-500/30">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-emerald-400 font-medium">实时同步</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* 上方：场地状态部分 - 优先显示 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">场地状态</h2>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                <span className="text-emerald-400 font-medium">{courts.filter(court => court.match).length}</span> / {courts.length} 场地使用中
              </div>
              <button 
                onClick={() => { fetchCourts(); fetchSchedule(); fetchStatistics(); fetchPendingMatches(); }}
                className="p-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg border border-blue-500/30 transition-colors"
              >
                <RefreshCw className="h-4 w-4 text-blue-400" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {courts.map((court) => (
              <div 
                key={court.id}
                className="group relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl cursor-pointer"
                onClick={() => openCourtManager(court.id)}
              >
                {/* 场地标题 */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${court.match ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`}></div>
                    {court.name}
                  </h3>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    court.match ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                    'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}>
                    {court.match ? '比赛中' : '空闲'}
                  </div>
                </div>

                {/* 比赛信息 */}
                {court.match ? (
                  <div className="space-y-4">
                    {(() => {
                      const formattedScore = formatScore(court.match);
                      return (
                        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/30">
                          {/* 队伍信息表格 */}
                          <div className="space-y-3">
                            <div className="grid grid-cols-6 gap-2 text-xs text-gray-400 font-medium">
                              <div>队伍</div>
                              <div>队员</div>
                              <div className="text-center">第一局</div>
                              <div className="text-center">第二局</div>
                              <div className="text-center">第三局</div>
                              <div className="text-center">总局分</div>
                            </div>
                            
                            {/* Team A */}
                            <div className="grid grid-cols-6 gap-2 items-center py-2 border-b border-gray-700/50">
                              <div className="text-blue-400 font-semibold text-sm">{court.match.teamA}</div>
                              <div className="text-gray-300 text-xs">队员A</div>
                              {[0, 1, 2].map((setIndex) => (
                                <div key={setIndex} className="text-center">
                                  {formattedScore.sets[setIndex] ? (
                                    <span className={`px-2 py-1 rounded text-xs ${
                                      formattedScore.sets[setIndex].winnerA 
                                        ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50' 
                                        : 'bg-gray-600/30 text-gray-400'
                                    }`}>
                                      {formattedScore.sets[setIndex].scoreA}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 text-xs">-</span>
                                  )}
                                </div>
                              ))}
                              <div className="text-center">
                                <span className="text-xl font-bold text-blue-400">{formattedScore.scoreA}</span>
                              </div>
                            </div>
                            
                            {/* Team B */}
                            <div className="grid grid-cols-6 gap-2 items-center py-2">
                              <div className="text-red-400 font-semibold text-sm">{court.match.teamB}</div>
                              <div className="text-gray-300 text-xs">队员B</div>
                              {[0, 1, 2].map((setIndex) => (
                                <div key={setIndex} className="text-center">
                                  {formattedScore.sets[setIndex] ? (
                                    <span className={`px-2 py-1 rounded text-xs ${
                                      formattedScore.sets[setIndex].winnerB 
                                        ? 'bg-red-500/30 text-red-300 border border-red-500/50' 
                                        : 'bg-gray-600/30 text-gray-400'
                                    }`}>
                                      {formattedScore.sets[setIndex].scoreB}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 text-xs">-</span>
                                  )}
                                </div>
                              ))}
                              <div className="text-center">
                                <span className="text-xl font-bold text-red-400">{formattedScore.scoreB}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="text-gray-500 text-sm mb-3">场地空闲</div>
                      <button 
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          assignNextMatch(court.id);
                        }}
                      >
                        分配下一场比赛
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 下方：赛程树和侧边栏 */}
        <div className="grid grid-cols-4 gap-6">
          {/* 左侧：赛程树 (3/4宽度) */}
          <div className="col-span-3">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">赛程树</h3>
              {schedule.length > 1 && (
                <div className="flex space-x-2">
                  {schedule.map((tournament, index) => (
                    <button
                      key={tournament.matchType}
                      onClick={() => setActiveTournament(index)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeTournament === index
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                      }`}
                    >
                      {tournament.matchTypeName || tournament.matchType}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {schedule.length > 0 && schedule[activeTournament] && (
              <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* 这里将实现新的树状结构布局 */}
                  <div className="text-gray-400 text-center py-8">
                    正在重构赛程树显示...
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：侧边栏信息 (1/4宽度) */}
          <div className="space-y-6">
            {/* 统计信息 */}
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <h4 className="text-lg font-semibold text-white mb-4">实时统计</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">总比赛数</span>
                  <span className="text-white font-medium">{statistics.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">已完成</span>
                  <span className="text-emerald-400 font-medium">{statistics.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">进行中</span>
                  <span className="text-blue-400 font-medium">{statistics.active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">等待中</span>
                  <span className="text-yellow-400 font-medium">{statistics.waiting}</span>
                </div>
              </div>
            </div>

            {/* 等待队列 */}
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <h4 className="text-lg font-semibold text-white mb-4">等待队列</h4>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {pendingMatches.slice(0, 5).map((match) => (
                  <div key={match.id} className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/30">
                    <div className="text-sm font-medium text-white mb-1">
                      {match.teamA} vs {match.teamB}
                    </div>
                    <div className="text-xs text-gray-400">
                      {match.matchType} • 第{match.round}轮
                    </div>
                  </div>
                ))}
                {pendingMatches.length === 0 && (
                  <div className="text-gray-500 text-sm text-center py-4">
                    暂无等待比赛
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}