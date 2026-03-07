declare module 'socket.io-client' {
  function io(url: string, opts?: Record<string, unknown>): SocketIOClient.Socket;
  export default io;

  namespace SocketIOClient {
    interface Socket {
      on(event: string, fn: (...args: any[]) => void): Socket;
      emit(event: string, ...args: any[]): Socket;
      disconnect(): Socket;
      connected: boolean;
      id: string;
    }
  }
}
