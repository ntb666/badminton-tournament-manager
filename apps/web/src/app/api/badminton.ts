import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000', // 你的后端地址
});

// 基础API
export const getTeams = async () => {
  const { data } = await api.get('/teams');
  return data;
};

export const getCourts = async () => {
  const { data } = await api.get('/courts');
  return data;
};

export const getMatches = async () => {
  const { data } = await api.get('/matches');
  return data;
};

// 新增API - 匹配前端需求
export const getLiveCourts = async () => {
  const { data } = await api.get('/api/courts/live');
  return data;
};

export const getScheduleTree = async () => {
  const { data } = await api.get('/api/schedule/tree');
  return data;
};

export const getMatchQueue = async () => {
  const { data } = await api.get('/api/matches/queue');
  return data;
};

export const createTeam = async (team: { name: string; players: string; type: string }) => {
  const { data } = await api.post('/api/teams', team);
  return data;
};

export const generateMatches = async (matchType: string) => {
  const { data } = await api.post('/api/matches/generate', { matchType });
  return data;
};
