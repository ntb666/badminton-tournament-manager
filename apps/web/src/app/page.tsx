"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Trophy, Users, Clock, Activity, RefreshCw, Zap, Upload, Settings } from "lucide-react";
import io from "socket.io-client";
import TournamentBracket from "../components/TournamentBracket";
import ImportPage from "../components/ImportPage";
import AdminPanel from "../components/AdminPanel";
import styles from "./dashboard.module.css";

// 类型定义
interface Court {
  id: number;
  name: string;
  match?: {
    id: number;
    teamA: string | { name: string };
    teamB: string | { name: string };
    scoreA: number | null;
    scoreB: number | null;
    status: string;
    scoreHistory?: string;
    gameSettings?: string;
    matchType?: string;
    round?: number;
  } | null;
  status?: 'available' | 'occupied';
}

export default function ModernDashboard() {
  const [mounted, setMounted] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [socket, setSocket] = useState<any>(null);
  const [selectedTournamentType, setSelectedTournamentType] = useState<string>('MEN_DOUBLE');
  const [statistics, setStatistics] = useState({ total: 0, completed: 0, active: 0, waiting: 0 });
  const [pendingMatches, setPendingMatches] = useState<any[]>([]);
  const [showImportPage, setShowImportPage] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null); // 新增：选中的比赛
  const [showScoreInput, setShowScoreInput] = useState(false); // 新增：显示比分输入对话框
  const [scoreInputMatch, setScoreInputMatch] = useState<any>(null); // 新增：需要输入比分的比赛
  const [scoreInputValues, setScoreInputValues] = useState({
    scoreA: [0, 0, 0], // 三局比分
    scoreB: [0, 0, 0],
    gameCount: 1 // 比赛局数 (1/3/5)
  }); // 新增：比分输入值
  const [enabledMatchTypes, setEnabledMatchTypes] = useState({
    MEN_SINGLE: true,
    WOMEN_SINGLE: true,
    MEN_DOUBLE: true,
    WOMEN_DOUBLE: true,
    MIX_DOUBLE: true
  });

  // 安全获取team名称的辅助函数 - 显示队员名字组合
  const getTeamName = (team: string | { name: string; players?: string } | undefined | null, fallback: string = '待定'): string => {
    if (!team) return fallback;
    if (typeof team === 'string') return team;
    if (typeof team === 'object') {
      // 优先显示队员名字组合
      if (team.players) {
        const players = team.players.split(/[,，、]/).map(p => p.trim()).filter(p => p);
        if (players.length >= 2) {
          return `${players[0]}/${players[1]}`;
        } else if (players.length === 1) {
          return players[0];
        }
      }
      // 如果没有队员信息，fallback到队伍名称
      if (team.name) return team.name;
    }
    return fallback;
  };

  // 获取启用的比赛类型配置
  const getAvailableMatchTypes = () => {
    const allMatchTypes = [
      { type: 'MEN_SINGLE' as const, label: '男子单打' },
      { type: 'WOMEN_SINGLE' as const, label: '女子单打' },
      { type: 'MEN_DOUBLE' as const, label: '男子双打' },
      { type: 'WOMEN_DOUBLE' as const, label: '女子双打' },
      { type: 'MIX_DOUBLE' as const, label: '混合双打' }
    ];
    
    return allMatchTypes.filter(matchType => enabledMatchTypes[matchType.type]);
  };
  const getMatchTypeText = (matchType: string): string => {
    switch (matchType) {
      case 'MEN_SINGLE':
        return '男单';
      case 'WOMEN_SINGLE':
        return '女单';
      case 'MEN_DOUBLE':
        return '男双';
      case 'WOMEN_DOUBLE':
        return '女双';
      case 'MIX_DOUBLE':
        return '混双';
      default:
        return '未知';
    }
  };

  // 分配下一场比赛到指定场地
  const assignNextMatch = async (courtId: number) => {
    try {
      const response = await fetch(`http://localhost:4001/api/courts/${courtId}/assign-next-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('Match assigned successfully:', result);
        // 使用辅助函数刷新数据
        await refreshCourtsData();
        await refreshPendingMatches();
        
        alert(`比赛分配成功！\n${result.teamA.name} vs ${result.teamB.name}\n已分配到 ${result.court.name}`);
      } else {
        alert(result.message || '分配失败');
      }
    } catch (error) {
      console.error('Error assigning match:', error);
      alert('分配比赛时发生错误');
    }
  };

  // 打开场地管理器
  const openCourtManager = (courtId: number) => {
    const courtManagerUrl = `http://localhost:3001?courtId=${courtId}`;
    window.open(courtManagerUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
  };

  // 处理比赛选择
  const handleMatchSelect = (match: any) => {
    setSelectedMatch(match);
    console.log('选中比赛:', match);
  };

  // 获取队员名字组合显示
  const getTeamDisplayName = (team: any): string => {
    if (!team) return '待定'
    
    // 优先显示队员名字组合
    if (team.players) {
      const players = team.players.split(/[,，、]/).map((p: string) => p.trim()).filter((p: string) => p)
      if (players.length >= 2) {
        return `${players[0]}/${players[1]}`
      } else if (players.length === 1) {
        return players[0]
      }
    }
    
    // 如果没有队员信息，fallback到队伍名称
    return team.name || '待定'
  };

  // 手动分配选中的比赛到指定场地
  const assignSelectedMatchToCourt = async (courtId: number) => {
    if (!selectedMatch) {
      alert('请先选择一场比赛');
      return;
    }

    try {
      const response = await fetch(`http://localhost:4001/api/courts/${courtId}/assign-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ matchId: selectedMatch.id })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('Match assigned successfully:', result);
        // 清除选中状态
        setSelectedMatch(null);
        // 刷新数据
        await refreshCourtsData();
        await refreshPendingMatches();
        
        alert(`比赛分配成功！\n${getTeamDisplayName(selectedMatch.teamA)} vs ${getTeamDisplayName(selectedMatch.teamB)}\n已分配到场地 ${courtId}`);
      } else {
        alert(result.message || '分配失败');
      }
    } catch (error) {
      console.error('Error assigning match:', error);
      alert('分配比赛时发生错误');
    }
  };

  // 打开比分输入对话框
  const openScoreInput = (match: any) => {
    setScoreInputMatch(match);
    setScoreInputValues({
      scoreA: [0, 0, 0],
      scoreB: [0, 0, 0],
      gameCount: 1
    });
    setShowScoreInput(true);
  };

  // 关闭比分输入对话框
  const closeScoreInput = () => {
    setShowScoreInput(false);
    setScoreInputMatch(null);
    setScoreInputValues({
      scoreA: [0, 0, 0],
      scoreB: [0, 0, 0],
      gameCount: 1
    });
  };

  // 提交比分
  const submitScore = async () => {
    if (!scoreInputMatch) return;

    try {
      // 构造比分历史数据
      const scoreHistory = [];
      let totalScoreA = 0, totalScoreB = 0;
      let setsWonA = 0, setsWonB = 0;

      for (let i = 0; i < scoreInputValues.gameCount; i++) {
        const setScoreA = scoreInputValues.scoreA[i];
        const setScoreB = scoreInputValues.scoreB[i];
        
        if (setScoreA > 0 || setScoreB > 0) {
          scoreHistory.push({
            setNumber: i + 1,
            scoreA: setScoreA,
            scoreB: setScoreB,
            pointHistory: [] // 简化，不生成详细的得分历史
          });

          totalScoreA += setScoreA;
          totalScoreB += setScoreB;

          // 判断局获胜者（假设21分制，2分差）
          if (setScoreA >= 21 && setScoreA - setScoreB >= 2) {
            setsWonA++;
          } else if (setScoreB >= 21 && setScoreB - setScoreA >= 2) {
            setsWonB++;
          }
        }
      }

      // 判断比赛获胜者
      const winnerId = setsWonA > setsWonB ? scoreInputMatch.teamAId : 
                      setsWonB > setsWonA ? scoreInputMatch.teamBId : null;

      const response = await fetch(`http://100.74.143.98:4001/api/matches/${scoreInputMatch.id}/score`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scoreA: totalScoreA,
          scoreB: totalScoreB,
          scoreHistory: scoreHistory,
          winnerId: winnerId,
          status: winnerId ? 'completed' : 'playing',
          gameSettings: {
            maxSets: scoreInputValues.gameCount,
            pointsPerSet: 21,
            deuceDiff: 2
          }
        }),
      });

      if (response.ok) {
        alert('比分提交成功！');
        closeScoreInput();
        await refreshCourtsData();
        await refreshPendingMatches();
      } else {
        const errorData = await response.json();
        alert(`提交失败: ${errorData.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('Error submitting score:', error);
      alert('提交比分时发生错误');
    }
  };

  // 格式化比分显示（简化版）
  const formatScore = (match: any) => {
    if (!match.scoreHistory) {
      return { scoreA: match.scoreA ?? '-', scoreB: match.scoreB ?? '-', sets: [] };
    }
    try {
      const scoreHistory = JSON.parse(match.scoreHistory);
      let sets = scoreHistory.map((set: any) => ({ scoreA: set.scoreA, scoreB: set.scoreB, winnerA: set.scoreA > set.scoreB, winnerB: set.scoreB > set.scoreA }));
      return { scoreA: match.scoreA ?? '-', scoreB: match.scoreB ?? '-', sets };
    } catch {
      return { scoreA: match.scoreA ?? '-', scoreB: match.scoreB ?? '-', sets: [] };
    }
  };

  // 确定当前发球方（根据羽毛球规则：获得上一分的队伍发球）
  const getCurrentServer = (match: any) => {
    if (!match || !match.scoreHistory) return null;
    
    try {
      const scoreHistory = typeof match.scoreHistory === 'string' 
        ? JSON.parse(match.scoreHistory) 
        : match.scoreHistory;
      
      if (!scoreHistory || scoreHistory.length === 0) return null;
      
      // 获取当前进行的局
      const currentSet = scoreHistory[scoreHistory.length - 1];
      if (!currentSet || !currentSet.pointHistory || currentSet.pointHistory.length === 0) {
        // 如果没有得分记录，默认A队发球
        return 'A';
      }
      
      // 获取最后一分的得分者
      const lastPoint = currentSet.pointHistory[currentSet.pointHistory.length - 1];
      return lastPoint.scorer; // 'A' 或 'B'
    } catch (error) {
      console.error('Error parsing score history:', error);
      return null;
    }
  };

  useEffect(() => { setMounted(true); }, []);
  
  // 获取场地数据
  useEffect(() => {
    const fetchCourts = async () => {
      try {
        const response = await fetch('http://localhost:4001/api/courts/status');
        const data = await response.json();
        console.log('Courts data:', data); // 调试信息
        setCourts(data);
      } catch (error) {
        console.error('Error fetching courts:', error);
        // 设置默认场地数据以防API失败
        setCourts([
          { id: 1, name: 'Court 1号场地', match: null },
          { id: 2, name: 'Court 2号场地', match: null },
          { id: 3, name: 'Court 3号场地', match: null },
          { id: 4, name: 'Court 4号场地', match: null }
        ]);
      }
    };

    fetchCourts();
    
    // 每15秒刷新一次场地数据（更频繁以确保实时性）
    const interval = setInterval(fetchCourts, 15000);
    return () => clearInterval(interval);
  }, []);

  // 设置Socket.IO连接以获取实时更新
  useEffect(() => {
    const socketConnection = io('http://localhost:4001');
    setSocket(socketConnection);
    
    // 加入主控房间
    socketConnection.emit('join-room', 'dashboard');
    
    // 监听分数更新
    socketConnection.on('score-updated', (data) => {
      console.log('Score updated:', data);
      // 刷新场地状态
      refreshCourtsData();
    });

    // 监听比赛分配
    socketConnection.on('match-assigned', (data) => {
      console.log('Match assigned:', data);
      // 刷新场地状态和待分配比赛
      refreshCourtsData();
      refreshPendingMatches();
    });

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  // 刷新场地数据的辅助函数
  const refreshCourtsData = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/courts/status');
      const courtData = await response.json();
      setCourts(courtData);
    } catch (error) {
      console.error('Error fetching courts:', error);
    }
  };

  // 刷新待分配比赛的辅助函数
  const refreshPendingMatches = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/matches/pending');
      const data = await response.json();
      setPendingMatches(data);
    } catch (error) {
      console.error('Error fetching pending matches:', error);
    }
  };

  // 获取系统配置（包括启用的比赛类型）
  const fetchSystemConfig = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/admin/config');
      const result = await response.json();
      if (result.success && result.data.enabledMatchTypes) {
        setEnabledMatchTypes(result.data.enabledMatchTypes);
        
        // 如果当前选中的比赛类型被禁用了，选择第一个启用的类型
        const enabledTypes = Object.keys(result.data.enabledMatchTypes).filter(
          type => result.data.enabledMatchTypes[type]
        );
        if (enabledTypes.length > 0 && !result.data.enabledMatchTypes[selectedTournamentType]) {
          setSelectedTournamentType(enabledTypes[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching system config:', error);
    }
  };

  // 获取统计数据
  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const response = await fetch('http://localhost:4001/api/matches');
        const data = await response.json();
        const total = data.length;
        const completed = data.filter((m: any) => m.status === 'completed').length;
        const active = data.filter((m: any) => m.status === 'playing').length;
        const waiting = data.filter((m: any) => m.status === 'pending').length;
        
        setStatistics({ total, completed, active, waiting });
      } catch (error) {
        console.error('Error fetching statistics:', error);
      }
    };

    fetchStatistics();
    
    // 每10秒刷新一次统计数据
    const interval = setInterval(fetchStatistics, 10000);
    return () => clearInterval(interval);
  }, []);

  // 获取待分配比赛
  useEffect(() => {
    const fetchPendingMatches = async () => {
      try {
        const response = await fetch('http://localhost:4001/api/matches/pending');
        const data = await response.json();
        setPendingMatches(data);
      } catch (error) {
        console.error('Error fetching pending matches:', error);
      }
    };

    fetchPendingMatches();
    
    // 每15秒刷新一次待分配比赛
    const interval = setInterval(fetchPendingMatches, 15000);
    return () => clearInterval(interval);
  }, []);

  // 获取系统配置
  useEffect(() => {
    fetchSystemConfig();
    
    // 每30秒刷新一次系统配置
    const interval = setInterval(fetchSystemConfig, 30000);
    return () => clearInterval(interval);
  }, [selectedTournamentType]);

  if (!mounted) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingContent}>
          <div className={styles.spinner}></div>
          <div className={styles.loadingText}>加载中...</div>
        </div>
      </div>
    );
  }

  // 如果显示导入页面，则渲染导入组件
  if (showImportPage) {
    return <ImportPage onBack={() => setShowImportPage(false)} />;
  }

  // 如果显示管理员面板，则渲染管理员组件
  if (showAdminPanel) {
    return <AdminPanel onBack={() => setShowAdminPanel(false)} />;
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.backgroundDecor}>
        <div className={styles.blob1}></div>
        <div className={styles.blob2}></div>
        <div className={styles.blob3}></div>
      </div>
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className={styles.navBrand}>
            <div className={styles.navIcon}><Trophy size={24} color="white" /></div>
            <div>
              <h1 className={styles.navTitle}>羽毛球赛事管理</h1>
              <p className={styles.navSubtitle}>现代版控制台</p>
            </div>
          </div>
          <div className={styles.navActions}>
            <button 
              onClick={() => setShowAdminPanel(true)}
              className={styles.adminBtn}
              title="管理员设置"
            >
              <Settings size={20} />
              管理员设置
            </button>
            <div className={styles.statusIndicator}>
              <div className={styles.statusDot}></div>
              <span className={styles.statusText}>系统运行中</span>
            </div>
            <button className={styles.refreshButton}><RefreshCw size={20} /></button>
          </div>
        </div>
      </nav>
      <div className={styles.mainContent}>
        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} ${styles.blue}`}>
            <div className={styles.statContent}>
              <div className={`${styles.statIcon} ${styles.blue}`}><Users size={24} color="#60a5fa" /></div>
              <div><p className={`${styles.statLabel} ${styles.blue}`}>总比赛数</p><p className={styles.statValue}>{statistics.total}</p></div>
            </div>
          </div>
          <div className={`${styles.statCard} ${styles.green}`}>
            <div className={styles.statContent}>
              <div className={`${styles.statIcon} ${styles.green}`}><Trophy size={24} color="#4ade80" /></div>
              <div><p className={`${styles.statLabel} ${styles.green}`}>已完成</p><p className={styles.statValue}>{statistics.completed}</p></div>
            </div>
          </div>
          <div className={`${styles.statCard} ${styles.yellow}`}>
            <div className={styles.statContent}>
              <div className={`${styles.statIcon} ${styles.yellow}`}><Zap size={24} color="#fbbf24" /></div>
              <div><p className={`${styles.statLabel} ${styles.yellow}`}>进行中</p><p className={styles.statValue}>{statistics.active}</p></div>
            </div>
          </div>
          <div className={`${styles.statCard} ${styles.purple}`}>
            <div className={styles.statContent}>
              <div className={`${styles.statIcon} ${styles.purple}`}><Clock size={24} color="#a78bfa" /></div>
              <div><p className={`${styles.statLabel} ${styles.purple}`}>等待中</p><p className={styles.statValue}>{statistics.waiting}</p></div>
            </div>
          </div>
        </div>
        <div className={styles.cardContainer}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <div className={styles.cardTitleIcon}><Activity size={24} color="white" /></div>
              <div><h2 className={styles.cardTitleText}>场地状态</h2><p className={styles.cardSubtitle}>实时监控所有比赛场地</p></div>
            </div>
            <div style={{ color: '#94a3b8' }}>
              <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.5rem' }}>{courts.filter(court => court.match).length}</span>
              <span style={{ margin: '0 0.5rem' }}>/</span>
              <span style={{ fontWeight: '500', fontSize: '1.125rem' }}>{courts.length}</span>
              <span style={{ marginLeft: '0.5rem' }}>场地使用中</span>
            </div>
          </div>
          <div className={styles.courtsGrid}>
            {courts.map((court) => (
              <div 
                key={court.id} 
                className={`${styles.courtCard} ${court.match ? styles.hasMatch : ''}`}
                onClick={() => court.match ? openCourtManager(court.id) : null}
                style={{ cursor: court.match ? 'pointer' : 'default' }}
              >
                <div className={`${styles.courtStatusIndicator} ${court.match ? styles.active : styles.inactive}`}></div>
                <div className={styles.courtHeader}>
                  <div className={styles.courtInfo}>
                    <div className={`${styles.courtNumber} ${court.match ? styles.active : styles.inactive}`}>{court.id}</div>
                    <div>
                      <h3 className={styles.courtName}>{court.name}</h3>
                      <p className={`${styles.courtStatus} ${court.match ? styles.active : styles.inactive}`}>{court.match ? '🏸 比赛进行中' : '💤 等待分配'}</p>
                    </div>
                  </div>
                  <div className={`${styles.courtStatusBadge} ${court.match ? styles.active : styles.inactive}`}>{court.match ? '使用中' : '空闲'}</div>
                </div>
                {court.match ? (
                  <div className={styles.matchInfo}>
                    <div className={styles.matchHeader}>
                      <span className={styles.matchType}>{getMatchTypeText(court.match.matchType || '')}</span>
                      <span className={styles.matchRound}>第{court.match.round}轮</span>
                    </div>
                    <table className={styles.scoreTable}>
                      <thead>
                        <tr>
                          <th>队伍</th>
                          <th>第一局</th>
                          <th>第二局</th>
                          <th>第三局</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className={`${styles.teamName} ${styles.teamA}`}>
                            {getTeamName(court.match.teamA, '队伍A')}
                            {getCurrentServer(court.match) === 'A' && (
                              <span style={{ 
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                backgroundColor: '#10b981',
                                borderRadius: '50%',
                                marginLeft: '6px',
                                verticalAlign: 'middle'
                              }}></span>
                            )}
                          </td>
                          {[0, 1, 2].map((setIndex) => (
                            <td key={setIndex}>
                              {formatScore(court.match).sets[setIndex] ? (
                                <span className={styles.setScore}>{formatScore(court.match).sets[setIndex].scoreA}</span>
                              ) : (<span style={{ color: '#6b7280' }}>-</span>)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className={`${styles.teamName} ${styles.teamB}`}>
                            {getTeamName(court.match.teamB, '队伍B')}
                            {getCurrentServer(court.match) === 'B' && (
                              <span style={{ 
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                backgroundColor: '#10b981',
                                borderRadius: '50%',
                                marginLeft: '6px',
                                verticalAlign: 'middle'
                              }}></span>
                            )}
                          </td>
                          {[0, 1, 2].map((setIndex) => (
                            <td key={setIndex}>
                              {formatScore(court.match).sets[setIndex] ? (
                                <span className={styles.setScore}>{formatScore(court.match).sets[setIndex].scoreB}</span>
                              ) : (<span style={{ color: '#6b7280' }}>-</span>)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                      <div className={`${styles.matchStatusBadge} ${court.match.status === 'completed' ? styles.completed : styles.playing}`}>{court.match.status === 'completed' ? '✅ 已完成' : '⚡ 进行中'}</div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button 
                          className={styles.scoreInputButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            openScoreInput(court.match);
                          }}
                          title="直接输入最终比分"
                        >
                          📝 输入比分
                        </button>
                        {selectedMatch && (
                          <button 
                            className={`${styles.queueButton} ${styles.selected}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              assignSelectedMatchToCourt(court.id);
                            }}
                            title="将选中比赛添加到此场地等待队列"
                          >
                            排队等待
                          </button>
                        )}
                        <div style={{ fontSize: '0.875rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.75rem', borderRadius: '8px' }}>点击进入场地管理 →</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon}>🏸</div>
                    <div className={styles.emptyStateText}>场地空闲</div>
                    {selectedMatch ? (
                      <button 
                        className={`${styles.assignButton} ${styles.selected}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          assignSelectedMatchToCourt(court.id);
                        }}
                      >
                        分配选中比赛到此场地
                      </button>
                    ) : (
                      <button 
                        className={styles.assignButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          assignNextMatch(court.id);
                        }}
                        disabled={pendingMatches.length === 0}
                      >
                        {pendingMatches.length > 0 ? '分配下一场比赛' : '暂无待分配比赛'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className={styles.cardContainer}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitleText}>🏆 比赛赛程树</h3>
            <div className={styles.tournamentSelector}>
              {getAvailableMatchTypes().map((tournament) => (
                <button key={tournament.type} onClick={() => setSelectedTournamentType(tournament.type)} className={`${styles.tournamentButton} ${selectedTournamentType === tournament.type ? styles.active : styles.inactive}`}>{tournament.label}</button>
              ))}
            </div>
          </div>
          <TournamentBracket 
            selectedType={selectedTournamentType} 
            onMatchSelect={handleMatchSelect}
          />
        </div>
        {pendingMatches.length > 0 && (
          <div className={styles.cardContainer}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <div className={styles.cardTitleIcon} style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}><Clock size={24} color="white" /></div>
                <div><h3 className={styles.cardTitleText}>⏰ 等待队列</h3><p className={styles.cardSubtitle}>待分配的比赛</p></div>
              </div>
            </div>
            <div className={styles.pendingGrid}>
              {pendingMatches.map((match) => (
                <div key={match.id} className={styles.pendingCard}>
                  <div className={styles.pendingMatchNumber}>
                    {match.queueLabel || `#${match.queuePosition || '?'}`}
                  </div>
                  <div className={styles.pendingMatchTeams}>{getTeamName(match.teamA, '队伍A')} vs {getTeamName(match.teamB, '队伍B')}</div>
                  <div className={styles.pendingMatchMeta}>{String(match.matchType || '')} • 第{String(match.round || 1)}轮</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 比分输入对话框 */}
      {showScoreInput && scoreInputMatch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            minWidth: '500px',
            maxWidth: '600px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, marginBottom: '8px', fontSize: '20px', fontWeight: '600', color: '#111827' }}>
                直接输入比分
              </h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                {getTeamName(scoreInputMatch.teamA)} vs {getTeamName(scoreInputMatch.teamB)}
              </p>
            </div>

            {/* 比赛局数选择 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                比赛局数
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 3, 5].map((count) => (
                  <button
                    key={count}
                    onClick={() => setScoreInputValues(prev => ({ ...prev, gameCount: count }))}
                    style={{
                      padding: '8px 16px',
                      border: '2px solid',
                      borderColor: scoreInputValues.gameCount === count ? '#3b82f6' : '#d1d5db',
                      backgroundColor: scoreInputValues.gameCount === count ? '#eff6ff' : 'white',
                      color: scoreInputValues.gameCount === count ? '#3b82f6' : '#6b7280',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    {count}局{count > 1 ? (count === 3 ? '两胜' : '三胜') : '制'}
                  </button>
                ))}
              </div>
            </div>

            {/* 比分输入表格 */}
            <div style={{ marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ 
                      textAlign: 'left', 
                      padding: '12px 8px', 
                      borderBottom: '2px solid #e5e7eb',
                      fontWeight: '600',
                      color: '#374151'
                    }}>队伍</th>
                    {Array.from({ length: scoreInputValues.gameCount }, (_, i) => (
                      <th key={i} style={{ 
                        textAlign: 'center', 
                        padding: '12px 8px', 
                        borderBottom: '2px solid #e5e7eb',
                        fontWeight: '600',
                        color: '#374151'
                      }}>第{i + 1}局</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ 
                      padding: '12px 8px', 
                      borderBottom: '1px solid #f3f4f6',
                      fontWeight: '500',
                      color: '#374151'
                    }}>
                      {getTeamName(scoreInputMatch.teamA)}
                    </td>
                    {Array.from({ length: scoreInputValues.gameCount }, (_, i) => (
                      <td key={i} style={{ padding: '8px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={scoreInputValues.scoreA[i]}
                          onChange={(e) => {
                            const newScores = [...scoreInputValues.scoreA];
                            newScores[i] = parseInt(e.target.value) || 0;
                            setScoreInputValues(prev => ({ ...prev, scoreA: newScores }));
                          }}
                          style={{
                            width: '60px',
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            textAlign: 'center',
                            fontSize: '16px'
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ 
                      padding: '12px 8px',
                      fontWeight: '500',
                      color: '#374151'
                    }}>
                      {getTeamName(scoreInputMatch.teamB)}
                    </td>
                    {Array.from({ length: scoreInputValues.gameCount }, (_, i) => (
                      <td key={i} style={{ padding: '8px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={scoreInputValues.scoreB[i]}
                          onChange={(e) => {
                            const newScores = [...scoreInputValues.scoreB];
                            newScores[i] = parseInt(e.target.value) || 0;
                            setScoreInputValues(prev => ({ ...prev, scoreB: newScores }));
                          }}
                          style={{
                            width: '60px',
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            textAlign: 'center',
                            fontSize: '16px'
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 操作按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={closeScoreInput}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#374151',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                取消
              </button>
              <button
                onClick={submitScore}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                提交比分
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}