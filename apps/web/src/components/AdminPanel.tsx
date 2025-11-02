"use client";

import React, { useState, useEffect } from "react";
import { 
  Settings, 
  RotateCcw, 
  Database, 
  Download, 
  Upload,
  Zap,
  Edit3, 
  Save, 
  Trash2, 
  Plus, 
  AlertTriangle,
  CheckCircle,
  X,
  Users,
  Trophy,
  Target,
  MapPin,
  PenTool
} from "lucide-react";
import styles from "./AdminPanel.module.css";
import ManualBracketAssignment from "./ManualBracketAssignment";

interface Team {
  id: number;
  name: string;
  players: string;
  matchType: string;
  contactInfo?: string;
  createdAt: string;
}

interface Match {
  id: number;
  teamA: { name: string; players: string };
  teamB: { name: string; players: string };
  status: string;
  scoreA?: number;
  scoreB?: number;
  matchType: string;
  round: number;
}

interface AdminPanelProps {
  onBack: () => void;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'teams' | 'import' | 'bracket' | 'manual-bracket' | 'assign' | 'export' | 'config' | 'database' | 'reset'>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  
  // 新增队伍相关状态
  const [showAddTeamForm, setShowAddTeamForm] = useState(false);
  const [newTeam, setNewTeam] = useState({
    name: '',
    players: '',
    matchType: 'MEN_DOUBLE',
    contactInfo: ''
  });
  const [selectedMatchTypeFilter, setSelectedMatchTypeFilter] = useState<string>('ALL');

  // 导入相关状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  // 赛程生成相关状态
  const [bracketMatchType, setBracketMatchType] = useState<string>('MEN_DOUBLE');
  const [seedPlayers, setSeedPlayers] = useState<{ [teamId: number]: number }>({});
  const [generatingBracket, setGeneratingBracket] = useState(false);
  const [bracketGenerated, setBracketGenerated] = useState(false);
  
  // 手动分配赛程相关状态
  const [manualBracketMatchType, setManualBracketMatchType] = useState<string>('MEN_DOUBLE');

  // 配置状态
  const [config, setConfig] = useState({
    tournamentName: '羽毛球锦标赛',
    venue: '体育馆',
    organizer: '主办方',
    contactPhone: '',
    contactEmail: '',
    defaultGameSettings: '21分制，三局两胜',
    courtCount: 4,
    hasBronzeMatch: false,
    enabledMatchTypes: {
      MEN_SINGLE: true,
      WOMEN_SINGLE: true,
      MEN_DOUBLE: true,
      WOMEN_DOUBLE: true,
      MIX_DOUBLE: true
    }
  });

  // 数据库查看状态
  const [databaseContent, setDatabaseContent] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<string>('teams');
  const [expandedRecords, setExpandedRecords] = useState<Set<number>>(new Set());

  // 获取所有队伍数据
  const fetchTeams = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/teams');
      const data = await response.json();
      
      // 映射后端字段到前端期待的字段结构
      const mappedTeams = data.map((team: any) => ({
        ...team,
        matchType: team.type,  // 将后端的 'type' 字段映射为前端的 'matchType'
        createdAt: team.createdAt || new Date().toISOString()  // 确保有创建时间
      }));
      
      setTeams(mappedTeams);
    } catch (error) {
      console.error('获取队伍数据失败:', error);
      showNotification('error', '获取队伍数据失败');
    }
  };

  // 获取所有比赛数据
  const fetchMatches = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/matches');
      const data = await response.json();
      setMatches(data);
    } catch (error) {
      console.error('获取比赛数据失败:', error);
      showNotification('error', '获取比赛数据失败');
    }
  };

  // 显示通知
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // 一键重置比赛进程
  const resetTournament = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:4001/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        showNotification('success', '比赛数据已重置！');
        await Promise.all([fetchTeams(), fetchMatches()]);
      } else {
        const error = await response.json();
        showNotification('error', error.message || '重置失败');
      }
    } catch (error) {
      console.error('重置失败:', error);
      showNotification('error', '重置失败：网络错误');
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  // 更新队伍信息
  const updateTeam = async (teamId: number, updates: Partial<Team>) => {
    setLoading(true);
    try {
      // 转换字段名以匹配后端API
      const updateData = {
        ...(updates.name && { name: updates.name }),
        ...(updates.players && { players: updates.players }),
        ...(updates.matchType && { type: updates.matchType })  // 后端使用 'type' 字段
      };

      const response = await fetch(`http://localhost:4001/api/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      if (response.ok) {
        showNotification('success', '队伍信息已更新！');
        await fetchTeams();
        setEditingTeam(null);
      } else {
        const error = await response.json();
        showNotification('error', error.message || '更新失败');
      }
    } catch (error) {
      console.error('更新队伍失败:', error);
      showNotification('error', '更新失败：网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 删除队伍
  const deleteTeam = async (teamId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:4001/api/teams/${teamId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        showNotification('success', '队伍已删除！');
        await fetchTeams();
      } else {
        const error = await response.json();
        showNotification('error', error.message || '删除失败');
      }
    } catch (error) {
      console.error('删除队伍失败:', error);
      showNotification('error', '删除失败：网络错误');
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  // 新增队伍
  const addTeam = async () => {
    if (!newTeam.name.trim() || !newTeam.players.trim()) {
      showNotification('error', '请填写队伍名称和队员信息');
      return;
    }

    setLoading(true);
    try {
      // 转换字段名以匹配后端API
      const teamData = {
        name: newTeam.name,
        players: newTeam.players,
        type: newTeam.matchType  // 后端使用 'type' 字段
      };

      const response = await fetch('http://localhost:4001/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData)
      });
      
      if (response.ok) {
        showNotification('success', '队伍添加成功！');
        await fetchTeams();
        setNewTeam({ name: '', players: '', matchType: 'MEN_DOUBLE', contactInfo: '' });
        setShowAddTeamForm(false);
      } else {
        const error = await response.json();
        showNotification('error', error.message || '添加失败');
      }
    } catch (error) {
      console.error('添加队伍失败:', error);
      showNotification('error', '添加失败：网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 按比赛类型筛选队伍
  const getFilteredTeams = () => {
    if (selectedMatchTypeFilter === 'ALL') {
      return teams;
    }
    return teams.filter(team => team.matchType === selectedMatchTypeFilter);
  };

  // 按比赛类型分组队伍
  const getTeamsByMatchType = () => {
    const grouped: { [key: string]: Team[] } = {};
    teams.forEach(team => {
      if (!grouped[team.matchType]) {
        grouped[team.matchType] = [];
      }
      grouped[team.matchType].push(team);
    });
    return grouped;
  };

  // 获取比赛类型显示名称
  const getMatchTypeDisplayName = (matchType: string) => {
    switch (matchType) {
      case 'MEN_SINGLE': return '男子单打';
      case 'WOMEN_SINGLE': return '女子单打';
      case 'MEN_DOUBLE': return '男子双打';
      case 'WOMEN_DOUBLE': return '女子双打';
      case 'MIX_DOUBLE': return '混合双打';
      default: return matchType;
    }
  };

  // 导出比赛结果
  const exportResults = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/admin/export');
      const data = await response.json();
      
      // 创建下载链接
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `比赛结果_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showNotification('success', '比赛结果已导出！');
    } catch (error) {
      console.error('导出失败:', error);
      showNotification('error', '导出失败：网络错误');
    }
  };

  // 获取系统配置
  const fetchConfig = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/admin/config');
      const result = await response.json();
      if (result.success) {
        setConfig(result.data);
      }
    } catch (error) {
      console.error('获取配置失败:', error);
      showNotification('error', '获取配置失败');
    }
  };

  // 保存系统配置
  const saveConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:4001/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        showNotification('success', '配置保存成功！');
      } else {
        const error = await response.json();
        showNotification('error', error.message || '配置保存失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      showNotification('error', '保存配置失败：网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 获取数据库内容
  const fetchDatabaseContent = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:4001/api/admin/database');
      if (response.ok) {
        const result = await response.json();
        setDatabaseContent(result.data);
        showNotification('success', '数据库内容加载成功');
      } else {
        const error = await response.json();
        showNotification('error', error.message || '获取数据库内容失败');
      }
    } catch (error) {
      console.error('获取数据库内容失败:', error);
      showNotification('error', '获取数据库内容失败：网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 切换记录展开状态
  const toggleRecordExpansion = (recordId: number) => {
    const newExpanded = new Set(expandedRecords);
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
    }
    setExpandedRecords(newExpanded);
  };

  // 格式化JSON显示
  const formatJSON = (obj: any, indent: number = 0): string => {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'string') return `"${obj}"`;
    if (typeof obj === 'number' || typeof obj === 'boolean') return obj.toString();
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      const items: string[] = obj.map(item => ' '.repeat(indent + 2) + formatJSON(item, indent + 2));
      return '[\n' + items.join(',\n') + '\n' + ' '.repeat(indent) + ']';
    }
    
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) return '{}';
      const items: string[] = keys.map(key => 
        ' '.repeat(indent + 2) + `"${key}": ${formatJSON(obj[key], indent + 2)}`
      );
      return '{\n' + items.join(',\n') + '\n' + ' '.repeat(indent) + '}';
    }
    
    return String(obj);
  };

  // 导入相关函数
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      showNotification('error', '请先选择文件');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // 首先上传和预览文件
      const response = await fetch('http://localhost:4001/api/import/upload-preview', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        setImportResult(result);
        if (result.validation.valid) {
          showNotification('info', `文件解析成功！共${result.totalRows}行数据，${result.validRows}行有效`);
        } else {
          showNotification('error', '文件存在错误，请检查后重新上传');
        }
      } else {
        showNotification('error', result.error || '文件上传失败');
      }
    } catch (error) {
      console.error('导入失败:', error);
      showNotification('error', '导入失败：网络错误');
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!importResult || !importResult.validation.valid) {
      showNotification('error', '没有有效的数据可以导入');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch('http://localhost:4001/api/import/confirm-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          teams: importResult.data,
          replaceExisting
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        showNotification('success', result.message);
        setImportResult(null);
        setSelectedFile(null);
        await fetchTeams(); // 刷新队伍列表
      } else {
        showNotification('error', result.error || '导入失败');
      }
    } catch (error) {
      console.error('确认导入失败:', error);
      showNotification('error', '导入失败：网络错误');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/import/template');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'badminton_registration_template.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
        showNotification('success', '模板下载成功！');
      } else {
        showNotification('error', '模板下载失败');
      }
    } catch (error) {
      console.error('下载模板失败:', error);
      showNotification('error', '下载模板失败：网络错误');
    }
  };

  // 赛程生成相关函数
  const setSeedPlayer = (teamId: number, seedRank: number) => {
    setSeedPlayers(prev => {
      const newSeeds = { ...prev };
      
      // 如果设置为0，则移除种子
      if (seedRank === 0) {
        delete newSeeds[teamId];
      } else {
        // 检查是否已有该种子排名
        const existingTeamWithSeed = Object.entries(newSeeds).find(([_, rank]) => rank === seedRank);
        if (existingTeamWithSeed) {
          delete newSeeds[parseInt(existingTeamWithSeed[0])];
        }
        newSeeds[teamId] = seedRank;
      }
      
      return newSeeds;
    });
  };

  const generateBracket = async () => {
    if (!bracketMatchType) {
      showNotification('error', '请选择比赛类型');
      return;
    }

    setGeneratingBracket(true);
    try {
      // 将seedPlayers对象转换为数组格式：[teamId1, teamId2, ...]，按照种子排名排序
      const seedPlayersArray = Object.entries(seedPlayers)
        .sort(([, rankA], [, rankB]) => rankA - rankB)  // 按种子排名排序
        .map(([teamId]) => parseInt(teamId));  // 提取teamId
      
      console.log('发送种子选手数据:', seedPlayersArray);
      console.log('铜牌赛设置:', config.hasBronzeMatch);
      
      const response = await fetch('http://localhost:4001/api/schedule/generate-bracket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          matchType: bracketMatchType,
          seedPlayers: seedPlayersArray,
          hasBronzeMatch: config.hasBronzeMatch
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        const bronzeText = config.hasBronzeMatch ? '（含铜牌赛）' : '';
        showNotification('success', `成功生成${bracketMatchType}比赛的赛程树${bronzeText}！`);
        setBracketGenerated(true);
        await fetchMatches(); // 刷新比赛数据
      } else {
        showNotification('error', result.error || '赛程生成失败');
      }
    } catch (error) {
      console.error('生成赛程失败:', error);
      showNotification('error', '生成赛程失败：网络错误');
    } finally {
      setGeneratingBracket(false);
    }
  };

  const clearBracket = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/schedule/clear-bracket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          matchType: bracketMatchType
        })
      });

      if (response.ok) {
        showNotification('success', '赛程已清空');
        setBracketGenerated(false);
        setSeedPlayers({});
        await fetchMatches();
      } else {
        const error = await response.json();
        showNotification('error', error.message || '清空赛程失败');
      }
    } catch (error) {
      console.error('清空赛程失败:', error);
      showNotification('error', '清空赛程失败：网络错误');
    }
  };
  
  const showConfirm = (action: string, callback: () => void) => {
    setConfirmAction(action);
    setShowConfirmDialog(true);
    // 临时保存回调函数
    (window as any).pendingCallback = callback;
  };

  const handleConfirm = () => {
    if ((window as any).pendingCallback) {
      (window as any).pendingCallback();
      delete (window as any).pendingCallback;
    }
  };

  useEffect(() => {
    fetchTeams();
    fetchMatches();
    fetchConfig();
  }, []);

  return (
    <div className={styles.adminPanel}>
      {/* 通知组件 */}
      {notification && (
        <div className={`${styles.notification} ${styles[notification.type]}`}>
          <div className={styles.notificationContent}>
            {notification.type === 'success' && <CheckCircle size={20} />}
            {notification.type === 'error' && <AlertTriangle size={20} />}
            {notification.type === 'info' && <Settings size={20} />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      {showConfirmDialog && (
        <div className={styles.overlay}>
          <div className={styles.confirmDialog}>
            <div className={styles.confirmHeader}>
              <AlertTriangle size={24} color="#ef4444" />
              <h3>确认操作</h3>
            </div>
            <p>确定要执行「{confirmAction}」操作吗？此操作不可撤销。</p>
            <div className={styles.confirmActions}>
              <button 
                className={styles.cancelButton}
                onClick={() => setShowConfirmDialog(false)}
              >
                取消
              </button>
              <button 
                className={styles.confirmButton}
                onClick={handleConfirm}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 头部 */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          <X size={20} />
        </button>
        <div className={styles.headerContent}>
          <Settings size={28} />
          <div>
            <h1>管理员控制台</h1>
            <p>系统管理与配置</p>
          </div>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className={styles.tabNav}>
        <button 
          className={`${styles.tabButton} ${activeTab === 'teams' ? styles.active : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          <Users size={18} />
          队伍管理
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'import' ? styles.active : ''}`}
          onClick={() => setActiveTab('import')}
        >
          <Upload size={18} />
          导入报名表
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'bracket' ? styles.active : ''}`}
          onClick={() => setActiveTab('bracket')}
        >
          <Zap size={18} />
          自动生成赛程
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'manual-bracket' ? styles.active : ''}`}
          onClick={() => setActiveTab('manual-bracket')}
        >
          <PenTool size={18} />
          手动分配赛程
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'assign' ? styles.active : ''}`}
          onClick={() => setActiveTab('assign')}
        >
          <MapPin size={18} />
          场地分配
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'export' ? styles.active : ''}`}
          onClick={() => setActiveTab('export')}
        >
          <Download size={18} />
          数据导出
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'config' ? styles.active : ''}`}
          onClick={() => setActiveTab('config')}
        >
          <Target size={18} />
          系统配置
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'database' ? styles.active : ''}`}
          onClick={() => {
            setActiveTab('database');
            if (!databaseContent) {
              fetchDatabaseContent();
            }
          }}
        >
          <Database size={18} />
          数据库查看
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'reset' ? styles.active : ''}`}
          onClick={() => setActiveTab('reset')}
        >
          <RotateCcw size={18} />
          系统重置
        </button>
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        {/* 数据库查看标签页 */}
        {activeTab === 'database' && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Database size={24} />
                <div>
                  <h3>数据库查看</h3>
                  <p>查看系统数据库的原始内容</p>
                </div>
              </div>

              {databaseContent ? (
                <div>
                  {/* 数据库概览 */}
                  <div className={styles.databaseOverview}>
                    <div className={styles.overviewGrid}>
                      <div className={styles.overviewItem}>
                        <h4>总记录数</h4>
                        <span className={styles.overviewNumber}>{databaseContent.metadata.totalRecords}</span>
                      </div>
                      <div className={styles.overviewItem}>
                        <h4>数据表数</h4>
                        <span className={styles.overviewNumber}>{Object.keys(databaseContent.tables).length}</span>
                      </div>
                      <div className={styles.overviewItem}>
                        <h4>最后更新</h4>
                        <span className={styles.overviewText}>{databaseContent.metadata.lastUpdated}</span>
                      </div>
                    </div>
                  </div>

                  {/* 表格选择器 */}
                  <div className={styles.tableSelector}>
                    <h4>选择数据表：</h4>
                    <div className={styles.tableTabs}>
                      {Object.entries(databaseContent.tables).map(([tableName, tableData]: [string, any]) => (
                        <button
                          key={tableName}
                          className={`${styles.tableTab} ${selectedTable === tableName ? styles.active : ''}`}
                          onClick={() => setSelectedTable(tableName)}
                        >
                          <span className={styles.tableName}>{tableName}</span>
                          <span className={styles.tableCount}>({tableData.count})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 表格内容 */}
                  {databaseContent.tables[selectedTable] && (
                    <div className={styles.tableContent}>
                      <div className={styles.tableHeader}>
                        <h4>{selectedTable} 表</h4>
                        <span className={styles.tableDescription}>
                          {databaseContent.tables[selectedTable].description || '数据表内容'}
                        </span>
                      </div>

                      <div className={styles.recordsList}>
                        {databaseContent.tables[selectedTable].data.map((record: any, index: number) => (
                          <div key={record.id || index} className={styles.recordItem}>
                            <div 
                              className={styles.recordHeader}
                              onClick={() => toggleRecordExpansion(record.id || index)}
                            >
                              <span className={styles.recordId}>ID: {record.id || index}</span>
                              <span className={styles.recordSummary}>
                                {selectedTable === 'teams' && `${record.name} (${record.type})`}
                                {selectedTable === 'courts' && `${record.name}`}
                                {selectedTable === 'matches' && `${record.teamA?.name || 'Team A'} vs ${record.teamB?.name || 'Team B'} - ${record.status}`}
                              </span>
                              <span className={styles.expandIcon}>
                                {expandedRecords.has(record.id || index) ? '▼' : '▶'}
                              </span>
                            </div>
                            
                            {expandedRecords.has(record.id || index) && (
                              <div className={styles.recordDetails}>
                                <pre className={styles.jsonDisplay}>
                                  {formatJSON(record, 0)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 刷新按钮 */}
                  <div className={styles.databaseActions}>
                    <button 
                      className={styles.refreshButton}
                      onClick={fetchDatabaseContent}
                      disabled={loading}
                    >
                      {loading ? '刷新中...' : '刷新数据'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.loadingState}>
                  <p>点击刷新数据按钮加载数据库内容</p>
                  <button 
                    className={styles.loadButton}
                    onClick={fetchDatabaseContent}
                    disabled={loading}
                  >
                    {loading ? '加载中...' : '加载数据库内容'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 系统重置标签页 */}
        {activeTab === 'reset' && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Database size={24} />
                <div>
                  <h3>数据库重置</h3>
                  <p>将所有比赛数据恢复到初始状态</p>
                </div>
              </div>
              <div className={styles.resetStats}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>注册队伍</span>
                  <span className={styles.statValue}>{teams.length}支</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>比赛场次</span>
                  <span className={styles.statValue}>{matches.length}场</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>已完成</span>
                  <span className={styles.statValue}>
                    {matches.filter(m => m.status === 'completed').length}场
                  </span>
                </div>
              </div>
              <div className={styles.resetWarning}>
                <AlertTriangle size={20} />
                <div>
                  <strong>警告：</strong>此操作将删除所有比赛数据，包括队伍信息、比赛记录和比分。
                  操作完成后，系统将回到初始状态，所有数据不可恢复。
                </div>
              </div>
              <button 
                className={styles.resetButton}
                onClick={() => showConfirm('重置所有比赛数据', resetTournament)}
                disabled={loading}
              >
                <RotateCcw size={18} />
                {loading ? '重置中...' : '重置所有数据'}
              </button>
            </div>
          </div>
        )}

        {/* 队伍管理标签页 */}
        {activeTab === 'teams' && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Users size={24} />
                <div>
                  <h3>队伍信息管理</h3>
                  <p>按比赛类型管理所有注册队伍</p>
                </div>
                <button 
                  className={styles.addButton}
                  onClick={() => setShowAddTeamForm(true)}
                >
                  <Plus size={16} />
                  添加队伍
                </button>
              </div>

              {/* 筛选器 */}
              <div className={styles.filterContainer}>
                <label>筛选比赛类型：</label>
                <select
                  value={selectedMatchTypeFilter}
                  onChange={(e) => setSelectedMatchTypeFilter(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="ALL">全部类型</option>
                  <option value="MEN_SINGLE">男子单打</option>
                  <option value="WOMEN_SINGLE">女子单打</option>
                  <option value="MEN_DOUBLE">男子双打</option>
                  <option value="WOMEN_DOUBLE">女子双打</option>
                  <option value="MIX_DOUBLE">混合双打</option>
                </select>
              </div>

              {/* 新增队伍表单 */}
              {showAddTeamForm && (
                <div className={styles.addTeamForm}>
                  <h4>添加新队伍</h4>
                  <div className={styles.formGrid}>
                    <input
                      type="text"
                      value={newTeam.name}
                      onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                      placeholder="队伍名称"
                      className={styles.input}
                    />
                    <input
                      type="text"
                      value={newTeam.players}
                      onChange={(e) => setNewTeam({...newTeam, players: e.target.value})}
                      placeholder="队员名单（用逗号分隔，如：张三,李四）"
                      className={styles.input}
                    />
                    <select
                      value={newTeam.matchType}
                      onChange={(e) => setNewTeam({...newTeam, matchType: e.target.value})}
                      className={styles.select}
                    >
                      <option value="MEN_SINGLE">男子单打</option>
                      <option value="WOMEN_SINGLE">女子单打</option>
                      <option value="MEN_DOUBLE">男子双打</option>
                      <option value="WOMEN_DOUBLE">女子双打</option>
                      <option value="MIX_DOUBLE">混合双打</option>
                    </select>
                    <input
                      type="text"
                      value={newTeam.contactInfo}
                      onChange={(e) => setNewTeam({...newTeam, contactInfo: e.target.value})}
                      placeholder="联系方式（可选）"
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formActions}>
                    <button 
                      className={styles.saveButton}
                      onClick={addTeam}
                      disabled={loading}
                    >
                      <Save size={16} />
                      保存
                    </button>
                    <button 
                      className={styles.cancelButton}
                      onClick={() => {
                        setShowAddTeamForm(false);
                        setNewTeam({ name: '', players: '', matchType: 'MEN_DOUBLE', contactInfo: '' });
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* 按比赛类型分组显示队伍 */}
              {selectedMatchTypeFilter === 'ALL' ? (
                // 显示所有类型的分组
                Object.entries(getTeamsByMatchType()).map(([matchType, typeTeams]) => (
                  <div key={matchType} className={styles.matchTypeSection}>
                    <h4 className={styles.matchTypeTitle}>
                      <Trophy size={20} />
                      {getMatchTypeDisplayName(matchType)} ({typeTeams.length}支队伍)
                    </h4>
                    <div className={styles.teamsGrid}>
                      {typeTeams.map(team => (
                        <TeamCard 
                          key={team.id} 
                          team={team} 
                          editingTeam={editingTeam}
                          setEditingTeam={setEditingTeam}
                          updateTeam={updateTeam}
                          deleteTeam={deleteTeam}
                          showConfirm={showConfirm}
                          loading={loading}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                // 显示筛选后的队伍
                <div className={styles.teamsGrid}>
                  {getFilteredTeams().map(team => (
                    <TeamCard 
                      key={team.id} 
                      team={team} 
                      editingTeam={editingTeam}
                      setEditingTeam={setEditingTeam}
                      updateTeam={updateTeam}
                      deleteTeam={deleteTeam}
                      showConfirm={showConfirm}
                      loading={loading}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 导入报名表标签页 */}
        {activeTab === 'import' && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Upload size={24} />
                <div>
                  <h3>导入报名表</h3>
                  <p>批量导入队伍信息，支持Excel和CSV格式</p>
                </div>
              </div>
              
              <div className={styles.cardContent}>
                <div className={styles.importSection}>
                  <div className={styles.uploadArea}>
                    <div className={styles.uploadBox}>
                      <Upload size={48} color="#666" />
                      <h4>选择文件上传</h4>
                      <p>支持 .xlsx、.xls、.csv 格式</p>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileSelect}
                        className={styles.fileInput}
                        id="fileUpload"
                      />
                      <label htmlFor="fileUpload" className={styles.uploadBtn}>
                        选择文件
                      </label>
                      {selectedFile && (
                        <div className={styles.fileInfo}>
                          <p>已选择：{selectedFile.name}</p>
                          <button 
                            onClick={handleImport}
                            disabled={importing}
                            className={styles.parseBtn}
                          >
                            {importing ? '解析中...' : '解析文件'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.optionsContainer}>
                    <div className={styles.importOptions}>
                      <h4>导入选项</h4>
                      <div className={styles.checkboxContainer}>
                        <label className={styles.checkbox}>
                          <input
                            type="checkbox"
                            checked={replaceExisting}
                            onChange={(e) => setReplaceExisting(e.target.checked)}
                          />
                          <span>替换现有数据（清空所有队伍和比赛）</span>
                        </label>
                      </div>
                    </div>

                    <div className={styles.templateSection}>
                      <h4>下载模板</h4>
                      <p>如果您还没有报名表，可以下载我们的标准模板</p>
                      <button onClick={downloadTemplate} className={styles.templateBtn}>
                        <Download size={18} />
                        下载报名表模板
                      </button>
                    </div>
                  </div>
                </div>

                {/* 导入结果显示 */}
                {importResult && (
                  <div className={styles.importResult}>
                    <h4>文件解析结果</h4>
                    <div className={styles.resultStats}>
                      <div className={styles.stat}>
                        <span className={styles.number}>{importResult.totalRows}</span>
                        <span className={styles.label}>总行数</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.number}>{importResult.validRows}</span>
                        <span className={styles.label}>有效行数</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.number}>{importResult.validation.errors.length}</span>
                        <span className={styles.label}>错误数</span>
                      </div>
                    </div>

                    {/* 错误信息 */}
                    {importResult.validation.errors.length > 0 && (
                      <div className={styles.errorList}>
                        <h5>❌ 错误信息</h5>
                        {importResult.validation.errors.map((error: string, index: number) => (
                          <div key={index} className={styles.errorItem}>
                            {error}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 警告信息 */}
                    {importResult.validation.warnings.length > 0 && (
                      <div className={styles.warningList}>
                        <h5>⚠️ 警告信息</h5>
                        {importResult.validation.warnings.map((warning: string, index: number) => (
                          <div key={index} className={styles.warningItem}>
                            {warning}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 预览数据 */}
                    {importResult.preview && importResult.preview.length > 0 && (
                      <div className={styles.previewSection}>
                        <h5>📋 数据预览（前10行）</h5>
                        <div className={styles.previewTable}>
                          <table>
                            <thead>
                              <tr>
                                <th>队伍名称</th>
                                <th>队员</th>
                                <th>比赛类型</th>
                              </tr>
                            </thead>
                            <tbody>
                              {importResult.preview.map((team: any, index: number) => (
                                <tr key={index}>
                                  <td>{team.name}</td>
                                  <td>{team.players}</td>
                                  <td>{team.type}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 确认导入按钮 */}
                    {importResult.validation.valid && (
                      <div className={styles.confirmSection}>
                        <button 
                          onClick={confirmImport}
                          disabled={importing}
                          className={styles.confirmBtn}
                        >
                          {importing ? '导入中...' : '确认导入'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 手动分配赛程标签页 */}
        {activeTab === 'manual-bracket' && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <PenTool size={24} />
                <div>
                  <h3>手动分配赛程树</h3>
                  <p>手动选择每个对阵位置的队伍</p>
                </div>
              </div>
              
              <div className={styles.cardContent}>
                {/* 比赛类型选择 */}
                <div className={styles.bracketTypeSection}>
                  <h4>选择比赛类型</h4>
                  <select 
                    value={manualBracketMatchType} 
                    onChange={(e) => setManualBracketMatchType(e.target.value)}
                    className={styles.matchTypeSelect}
                  >
                    <option value="MEN_DOUBLE">男双</option>
                    <option value="WOMEN_DOUBLE">女双</option>
                    <option value="MIX_DOUBLE">混双</option>
                    <option value="MEN_SINGLE">男单</option>
                    <option value="WOMEN_SINGLE">女单</option>
                  </select>
                </div>

                {/* 手动分配组件 */}
                <ManualBracketAssignment 
                  matchType={manualBracketMatchType}
                  onComplete={() => {
                    showNotification('success', '手动赛程分配完成！');
                    fetchMatches();
                    setActiveTab('bracket');
                  }}
                  onCancel={() => setActiveTab('bracket')}
                />
              </div>
            </div>
          </div>
        )}

        {/* 自动生成赛程标签页 */}
        {activeTab === 'bracket' && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Zap size={24} />
                <div>
                  <h3>自动生成赛程树</h3>
                  <p>设置种子选手并自动随机生成比赛赛程</p>
                </div>
              </div>
              
              <div className={styles.cardContent}>
                {/* 比赛类型选择 */}
                <div className={styles.bracketTypeSection}>
                  <h4>选择比赛类型</h4>
                  <select 
                    value={bracketMatchType} 
                    onChange={(e) => setBracketMatchType(e.target.value)}
                    className={styles.matchTypeSelect}
                  >
                    <option value="MEN_DOUBLE">男双</option>
                    <option value="WOMEN_DOUBLE">女双</option>
                    <option value="MIX_DOUBLE">混双</option>
                    <option value="MEN_SINGLE">男单</option>
                    <option value="WOMEN_SINGLE">女单</option>
                  </select>
                </div>

                {/* 种子选手设置 */}
                <div className={styles.seedSection}>
                  <h4>种子选手设置</h4>
                  <p className={styles.seedDescription}>
                    选择种子选手，他们将在赛程中尽量远离以避免过早相遇
                  </p>
                  
                  <div className={styles.seedList}>
                    {teams
                      .filter(team => team.matchType === bracketMatchType)
                      .map(team => (
                        <div key={team.id} className={styles.seedItem}>
                          <div className={styles.teamInfo}>
                            <strong>{team.name}</strong>
                            <span className={styles.players}>{team.players}</span>
                          </div>
                          <select
                            value={seedPlayers[team.id] || 0}
                            onChange={(e) => setSeedPlayer(team.id, parseInt(e.target.value))}
                            className={styles.seedSelect}
                          >
                            <option value={0}>普通选手</option>
                            <option value={1}>1号种子</option>
                            <option value={2}>2号种子</option>
                            <option value={3}>3号种子</option>
                            <option value={4}>4号种子</option>
                            <option value={5}>5号种子</option>
                            <option value={6}>6号种子</option>
                            <option value={7}>7号种子</option>
                            <option value={8}>8号种子</option>
                          </select>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* 当前种子选手列表 */}
                {Object.keys(seedPlayers).length > 0 && (
                  <div className={styles.currentSeeds}>
                    <h4>当前种子选手</h4>
                    <div className={styles.seedSummary}>
                      {Object.entries(seedPlayers)
                        .sort(([,a], [,b]) => a - b)
                        .map(([teamId, seedRank]) => {
                          const team = teams.find(t => t.id === parseInt(teamId));
                          return (
                            <div key={teamId} className={styles.seedBadge}>
                              <span className={styles.seedRank}>{seedRank}号种子</span>
                              <span className={styles.seedName}>{team?.name}</span>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className={styles.bracketActions}>
                  <button 
                    onClick={generateBracket}
                    disabled={generatingBracket || teams.filter(t => t.matchType === bracketMatchType).length < 2}
                    className={styles.generateBtn}
                  >
                    {generatingBracket ? '生成中...' : '生成赛程树'}
                  </button>
                  
                  {bracketGenerated && (
                    <button 
                      onClick={() => showConfirm('清空赛程', clearBracket)}
                      className={styles.clearBracketBtn}
                    >
                      清空赛程
                    </button>
                  )}
                </div>

                {/* 赛程状态 */}
                <div className={styles.bracketStatus}>
                  <div className={styles.statusInfo}>
                    <p>
                      {bracketMatchType} 类型共有 {teams.filter(t => t.matchType === bracketMatchType).length} 支队伍
                    </p>
                    <p className={styles.configStatus}>
                      🥉 铜牌赛设置：{config.hasBronzeMatch ? '已启用' : '未启用'}
                      {config.hasBronzeMatch && <span className={styles.configNote}>（半决赛败者将进行三四名决赛）</span>}
                    </p>
                    {teams.filter(t => t.matchType === bracketMatchType).length < 2 && (
                      <p className={styles.warning}>⚠️ 至少需要2支队伍才能生成赛程</p>
                    )}
                    {bracketGenerated && (
                      <p className={styles.success}>✅ 赛程已生成，可在主页面查看比赛对阵</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 场地分配标签页 */}
        {activeTab === 'assign' && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <MapPin size={24} />
                <div>
                  <h3>场地分配</h3>
                  <p>将生成的比赛分配到可用场地</p>
                </div>
              </div>
              <div className={styles.assignContent}>
                <div className={styles.assignOptions}>
                  <div className={styles.assignOption}>
                    <div className={styles.optionInfo}>
                      <h4>🤖 自动分配</h4>
                      <p>系统自动将待分配的比赛按FIFO原则分配到可用场地</p>
                    </div>
                    <button 
                      className={styles.assignButton}
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const response = await fetch('http://localhost:4001/api/matches/assign-to-courts', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ autoAssign: true })
                          });
                          
                          if (response.ok) {
                            const result = await response.json();
                            showNotification('success', `成功自动分配 ${result.assignedMatches} 场比赛到场地！`);
                            await fetchMatches(); // 刷新比赛数据
                          } else {
                            const error = await response.json();
                            showNotification('error', error.error || '自动分配失败');
                          }
                        } catch (error) {
                          showNotification('error', '网络错误，分配失败');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                    >
                      {loading ? '分配中...' : '开始自动分配'}
                    </button>
                  </div>
                  
                  <div className={styles.assignOption}>
                    <div className={styles.optionInfo}>
                      <h4>📋 查看待分配队列</h4>
                      <p>查看当前等待分配场地的比赛列表</p>
                    </div>
                    <button 
                      className={styles.assignButton}
                      onClick={async () => {
                        try {
                          const response = await fetch('http://localhost:4001/api/matches/pending');
                          if (response.ok) {
                            const result = await response.json();
                            const pendingCount = result.data?.length || 0;
                            showNotification('info', `当前有 ${pendingCount} 场比赛等待分配场地`);
                          }
                        } catch (error) {
                          showNotification('error', '获取队列信息失败');
                        }
                      }}
                    >
                      查看队列
                    </button>
                  </div>
                </div>
                
                <div className={styles.assignStatus}>
                  <div className={styles.statusInfo}>
                    <h4>📊 分配状态</h4>
                    <p>
                      当前业务流程位置：
                      <br />
                      1. ✅ 导入报名表
                      <br />
                      2. ✅ 生成赛程树
                      <br />
                      3. ✅ 形成比赛队列
                      <br />
                      4. 🎯 <strong>为场地分配比赛</strong> ← 当前步骤
                      <br />
                      5. ⏳ 后续比赛管理
                    </p>
                  </div>
                </div>
                
                <div className={styles.assignHelp}>
                  <div className={styles.helpInfo}>
                    <h4>💡 使用说明</h4>
                    <ul>
                      <li>确保已完成报名表导入和赛程生成</li>
                      <li>自动分配会将比赛按创建顺序分配到空闲场地</li>
                      <li>手动分配功能可在主界面的场地管理中进行</li>
                      <li>分配完成后可在主界面查看各场地的比赛安排</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 数据导出标签页 */}
        {activeTab === 'export' && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Download size={24} />
                <div>
                  <h3>数据导出</h3>
                  <p>导出比赛结果和统计数据</p>
                </div>
              </div>
              <div className={styles.exportOptions}>
                <div className={styles.exportItem}>
                  <div className={styles.exportInfo}>
                    <Trophy size={20} />
                    <div>
                      <h4>完整比赛结果</h4>
                      <p>包含所有队伍、比赛记录和详细比分</p>
                    </div>
                  </div>
                  <button className={styles.exportButton} onClick={exportResults}>
                    <Download size={16} />
                    导出 JSON
                  </button>
                </div>
                <div className={styles.exportItem}>
                  <div className={styles.exportInfo}>
                    <Users size={20} />
                    <div>
                      <h4>队伍报名信息</h4>
                      <p>所有注册队伍的详细信息</p>
                    </div>
                  </div>
                  <button 
                    className={styles.exportButton}
                    onClick={() => {
                      const csv = teams.map(t => 
                        `"${t.name}","${t.players}","${t.matchType}","${t.contactInfo || ''}"`
                      ).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `队伍名单_${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download size={16} />
                    导出 CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 系统配置标签页 */}
        {activeTab === 'config' && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Target size={24} />
                <div>
                  <h3>系统配置</h3>
                  <p>自定义比赛设置和系统参数</p>
                </div>
              </div>
              <div className={styles.configForm}>
                <div className={styles.formGroup}>
                  <label>比赛名称</label>
                  <input
                    type="text"
                    value={config.tournamentName}
                    onChange={(e) => setConfig({...config, tournamentName: e.target.value})}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>比赛场地</label>
                  <input
                    type="text"
                    value={config.venue}
                    onChange={(e) => setConfig({...config, venue: e.target.value})}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>主办方</label>
                  <input
                    type="text"
                    value={config.organizer}
                    onChange={(e) => setConfig({...config, organizer: e.target.value})}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>联系电话</label>
                    <input
                      type="tel"
                      value={config.contactPhone}
                      onChange={(e) => setConfig({...config, contactPhone: e.target.value})}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>联系邮箱</label>
                    <input
                      type="email"
                      value={config.contactEmail}
                      onChange={(e) => setConfig({...config, contactEmail: e.target.value})}
                      className={styles.input}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>默认比赛规则</label>
                  <input
                    type="text"
                    value={config.defaultGameSettings}
                    onChange={(e) => setConfig({...config, defaultGameSettings: e.target.value})}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>启用的比赛类型</label>
                  <div className={styles.checkboxGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={config.enabledMatchTypes.MEN_SINGLE}
                        onChange={(e) => setConfig({
                          ...config,
                          enabledMatchTypes: {
                            ...config.enabledMatchTypes,
                            MEN_SINGLE: e.target.checked
                          }
                        })}
                        className={styles.checkbox}
                      />
                      男子单打
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={config.enabledMatchTypes.WOMEN_SINGLE}
                        onChange={(e) => setConfig({
                          ...config,
                          enabledMatchTypes: {
                            ...config.enabledMatchTypes,
                            WOMEN_SINGLE: e.target.checked
                          }
                        })}
                        className={styles.checkbox}
                      />
                      女子单打
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={config.enabledMatchTypes.MEN_DOUBLE}
                        onChange={(e) => setConfig({
                          ...config,
                          enabledMatchTypes: {
                            ...config.enabledMatchTypes,
                            MEN_DOUBLE: e.target.checked
                          }
                        })}
                        className={styles.checkbox}
                      />
                      男子双打
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={config.enabledMatchTypes.WOMEN_DOUBLE}
                        onChange={(e) => setConfig({
                          ...config,
                          enabledMatchTypes: {
                            ...config.enabledMatchTypes,
                            WOMEN_DOUBLE: e.target.checked
                          }
                        })}
                        className={styles.checkbox}
                      />
                      女子双打
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={config.enabledMatchTypes.MIX_DOUBLE}
                        onChange={(e) => setConfig({
                          ...config,
                          enabledMatchTypes: {
                            ...config.enabledMatchTypes,
                            MIX_DOUBLE: e.target.checked
                          }
                        })}
                        className={styles.checkbox}
                      />
                      混合双打
                    </label>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>比赛场地数量</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={config.courtCount}
                    onChange={(e) => setConfig({...config, courtCount: parseInt(e.target.value)})}
                    className={styles.input}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>赛程设置</label>
                  <div className={styles.checkboxGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={config.hasBronzeMatch}
                        onChange={(e) => setConfig({...config, hasBronzeMatch: e.target.checked})}
                        className={styles.checkbox}
                      />
                      🥉 启用铜牌赛（三四名决赛）
                    </label>
                  </div>
                  <div className={styles.helpText}>
                    启用后，半决赛败者将进行铜牌赛争夺第三名
                  </div>
                </div>
                
                <button 
                  className={styles.saveConfigButton}
                  onClick={saveConfig}
                  disabled={loading}
                >
                  <Save size={18} />
                  {loading ? '保存中...' : '保存配置'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// TeamCard 组件
interface TeamCardProps {
  team: Team;
  editingTeam: Team | null;
  setEditingTeam: (team: Team | null) => void;
  updateTeam: (teamId: number, updates: Partial<Team>) => void;
  deleteTeam: (teamId: number) => void;
  showConfirm: (message: string, action: () => void) => void;
  loading: boolean;
}

function TeamCard({ 
  team, 
  editingTeam, 
  setEditingTeam, 
  updateTeam, 
  deleteTeam, 
  showConfirm, 
  loading 
}: TeamCardProps) {
  const getMatchTypeDisplayName = (matchType: string) => {
    switch (matchType) {
      case 'MEN_SINGLE': return '男单';
      case 'WOMEN_SINGLE': return '女单';
      case 'MEN_DOUBLE': return '男双';
      case 'WOMEN_DOUBLE': return '女双';
      case 'MIX_DOUBLE': return '混双';
      default: return matchType;
    }
  };

  return (
    <div className={styles.teamCard}>
      {editingTeam?.id === team.id ? (
        <div className={styles.editForm}>
          <input
            type="text"
            value={editingTeam.name}
            onChange={(e) => setEditingTeam({...editingTeam, name: e.target.value})}
            placeholder="队伍名称"
            className={styles.input}
          />
          <input
            type="text"
            value={editingTeam.players}
            onChange={(e) => setEditingTeam({...editingTeam, players: e.target.value})}
            placeholder="队员名单（用逗号分隔）"
            className={styles.input}
          />
          <select
            value={editingTeam.matchType}
            onChange={(e) => setEditingTeam({...editingTeam, matchType: e.target.value})}
            className={styles.select}
          >
            <option value="MEN_SINGLE">男子单打</option>
            <option value="WOMEN_SINGLE">女子单打</option>
            <option value="MEN_DOUBLE">男子双打</option>
            <option value="WOMEN_DOUBLE">女子双打</option>
            <option value="MIX_DOUBLE">混合双打</option>
          </select>
          <input
            type="text"
            value={editingTeam.contactInfo || ''}
            onChange={(e) => setEditingTeam({...editingTeam, contactInfo: e.target.value})}
            placeholder="联系方式"
            className={styles.input}
          />
          <div className={styles.editActions}>
            <button 
              className={styles.saveButton}
              onClick={() => updateTeam(team.id, editingTeam)}
              disabled={loading}
            >
              <Save size={16} />
              保存
            </button>
            <button 
              className={styles.cancelButton}
              onClick={() => setEditingTeam(null)}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.teamInfo}>
          <div className={styles.teamHeader}>
            <h4>{team.name}</h4>
            <span className={styles.matchType}>
              {getMatchTypeDisplayName(team.matchType)}
            </span>
          </div>
          <p className={styles.players}>队员：{team.players}</p>
          {team.contactInfo && (
            <p className={styles.contact}>联系：{team.contactInfo}</p>
          )}
          <p className={styles.createdAt}>
            注册时间：{new Date(team.createdAt).toLocaleString()}
          </p>
          <div className={styles.teamActions}>
            <button 
              className={styles.editButton}
              onClick={() => setEditingTeam(team)}
            >
              <Edit3 size={16} />
              编辑
            </button>
            <button 
              className={styles.deleteButton}
              onClick={() => showConfirm(`删除队伍「${team.name}」`, () => deleteTeam(team.id))}
            >
              <Trash2 size={16} />
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}