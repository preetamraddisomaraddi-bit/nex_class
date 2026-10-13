import axios from 'axios';

// Resolve the selected server for every request.
const getBaseURL = () => {
  return localStorage.getItem('admin_server_url') || 'http://localhost:4000';
};

const api = axios.create({ timeout: 10000 });

api.interceptors.request.use(async (config) => {
  config.baseURL = `${getBaseURL().replace(/\/$/, '')}/api`;
  if (window.electronAPI) {
    const token = await window.electronAPI.getToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      if (window.electronAPI) {
        await window.electronAPI.clearToken();
      }
      window.location.href = '#/login';
    }
    return Promise.reject(error);
  }
);

export { api };
