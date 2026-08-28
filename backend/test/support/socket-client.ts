// RunsGateway 소켓 e2e 스펙 공용 헬퍼 — 연결·ack 대기를 Promise로 감싸 테스트 코드의 콜백 중첩을 없앤다.
import { io, type Socket } from 'socket.io-client';

/** API.md 8장 핸드셰이크: `auth.token`에 access token을 싣는다. */
export function connectSocket(baseUrl: string, accessToken: string): Socket {
  return io(`${baseUrl}/realtime`, {
    transports: ['websocket'],
    auth: { token: accessToken },
    forceNew: true,
  });
}

export function waitForConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (err: Error) => reject(err));
  });
}

/** socket.io 콜백 기반 ack를 Promise로 변환한다. */
export function emitWithAck<T>(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<T> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (ack: T) => resolve(ack));
  });
}

/** 서버가 특정 이벤트를 특정 타임아웃 안에 보내는지(또는 보내지 않는지) 확인할 때 쓴다. */
export function waitForEvent<T>(
  socket: Socket,
  event: string,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(`"${event}" 이벤트가 ${timeoutMs}ms 안에 오지 않았습니다.`),
        ),
      timeoutMs,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** T-16처럼 "이벤트가 오지 않아야 한다"를 증명할 때 쓴다 — 짧은 창 안에 도착하면 실패시킨다. */
export function assertNoEvent(
  socket: Socket,
  event: string,
  windowMs = 500,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = () => {
      clearTimeout(timer);
      reject(
        new Error(`"${event}" 이벤트가 발행되지 않아야 하는데 도착했습니다.`),
      );
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, windowMs);
    socket.once(event, handler);
  });
}
