import axios from 'axios';

// Get server URL dynamically, default to port 3000
const getBaseURL = () => {
  return localStorage.getItem('admin_server_url') || 'http://localhost:3000';
};

const api = axios.create({
  get baseURL() {
    return getBaseURL();
  }
});

api.interceptors.request.use(async (config) => {
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
