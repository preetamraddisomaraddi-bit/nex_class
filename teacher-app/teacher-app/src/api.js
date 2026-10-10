import axios from 'axios';
import { io } from 'socket.io-client';

// Read server IP from localStorage (teacher sets it once in settings)
export function getServerURL() {
  return localStorage.getItem('serverURL') || 'http://localhost:4000';
}

export function getAPI() {
  return axios.create({
    baseURL: `${getServerURL()}/api`,
    timeout: 10000,
  });
}

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(getServerURL(), { transports: ['websocket'] });
  }
  return socket;
}

export function resetSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
