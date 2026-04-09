import { useState, useCallback } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

export interface ExecutionProgress {
  runId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  percentage: number;
  currentTest?: string;
  currentStep?: number;
  totalSteps?: number;
  elapsedTime: number;
  results?: {
    passed: number;
    failed: number;
  };
}

export interface ExecuteOptions {
  suitePath: string;
  engine: 'playwright' | 'api' | 'testergizer';
  workers?: number;
  autVersion?: string;
}

export function useExecution() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<ExecutionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const connectSocket = useCallback((id: string) => {
    const newSocket = io('/', {
      path: '/socket.io',
      query: { runId: id },
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
    });

    newSocket.on('progress', (data: ExecutionProgress) => {
      setProgress(data);
      if (data.status === 'completed' || data.status === 'failed') {
        setIsRunning(false);
      }
    });

    newSocket.on('error', (err: string) => {
      setError(err);
      setIsRunning(false);
    });

    setSocket(newSocket);
    return newSocket;
  }, []);

  const execute = useCallback(async (options: ExecuteOptions) => {
    setIsRunning(true);
    setError(null);
    setProgress(null);

    try {
      const response = await axios.post('/api/v1/run', options);
      const { runId: newRunId, status } = response.data;
      setRunId(newRunId);

      if (status === 'running') {
        connectSocket(newRunId);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
      setIsRunning(false);
    }
  }, [connectSocket]);

  const cancel = useCallback(async () => {
    if (runId) {
      try {
        await axios.post(`/api/v1/run/${runId}/cancel`);
        socket?.disconnect();
        setIsRunning(false);
      } catch (err: any) {
        setError(err.message);
      }
    }
  }, [runId, socket]);

  return {
    execute,
    cancel,
    progress,
    isRunning,
    error,
    runId,
  };
}
