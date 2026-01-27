import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import {
  CournotConfig,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/game';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket() {
  const socketRef = useRef<GameSocket | null>(null);
  const {
    setGameState,
    setFirmThinking,
    resetFirmThinking,
    setLatestDecision,
    clearLatestDecisions,
    setError,
    setConnected,
  } = useGameStore();

  useEffect(() => {
    // Create socket connection
    const socket: GameSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setError('Failed to connect to server');
      setConnected(false);
    });

    // Game events
    socket.on('game-state', (state) => {
      setGameState(state);
      if (state.status !== 'running') {
        resetFirmThinking();
      }
    });

    socket.on('round-started', (roundNumber) => {
      console.log(`Round ${roundNumber} started`);
      clearLatestDecisions();
      setFirmThinking(1, true);
      setFirmThinking(2, true);
    });

    socket.on('llm-thinking', ({ firm, status }) => {
      console.log(`Firm ${firm}: ${status}`);
      setFirmThinking(firm, status === 'thinking');
    });

    socket.on('firm-decision', ({ firm, quantity, reasoning }) => {
      console.log(`Firm ${firm} decided: ${quantity}`);
      setFirmThinking(firm, false);
      setLatestDecision(firm, quantity, reasoning);
    });

    socket.on('round-complete', (result) => {
      console.log(`Round ${result.roundNumber} complete`, result);
      resetFirmThinking();
    });

    socket.on('game-over', (state) => {
      console.log('Game over', state);
      resetFirmThinking();
    });

    socket.on('error', (message) => {
      console.error('Game error:', message);
      setError(message);
      resetFirmThinking();
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [
    setGameState,
    setFirmThinking,
    resetFirmThinking,
    setLatestDecision,
    clearLatestDecisions,
    setError,
    setConnected,
  ]);

  // Socket action functions
  const configureGame = useCallback((config: CournotConfig) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('configure-game', config);
    }
  }, []);

  const startGame = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('start-game');
    }
  }, []);

  const pauseGame = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('pause-game');
    }
  }, []);

  const resumeGame = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('resume-game');
    }
  }, []);

  const resetGame = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('reset-game');
    }
  }, []);

  return {
    configureGame,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
  };
}
