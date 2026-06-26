import api from './axiosInstance';

export async function getLeaderboard() {
  try {
    const res = await api.get('/leaderboard');
    return res.data;
  } catch {
    return [];
  }
}
