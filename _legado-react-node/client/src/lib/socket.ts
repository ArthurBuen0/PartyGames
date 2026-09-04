import { io, type Socket } from 'socket.io-client';

/**
 * Em dev o Vite faz proxy de /socket.io para o servidor, e em produção o
 * servidor entrega o PWA — nos dois casos dá para falar com a própria origem.
 * VITE_SERVER_URL só é necessário se o front for hospedado separado da API.
 */
const url = import.meta.env.VITE_SERVER_URL as string | undefined;

export const socket: Socket = io(url ?? '/', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 600,
  reconnectionDelayMax: 4000,
  timeout: 8000
});
