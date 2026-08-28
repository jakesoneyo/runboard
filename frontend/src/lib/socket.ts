/**
 * socket.io 클라이언트 싱글턴. API.md 8장 — 네임스페이스 `/realtime`, 핸드셰이크 `auth.token`.
 *
 * 왜 싱글턴인가: 앱 안에서 여러 화면(실행 보드·버그 목록)이 동시에 실시간 이벤트를 구독할 수 있는데,
 * 화면마다 별도 연결을 열면 서버 커넥션 수만 늘고 룸 상태를 화면 간에 공유할 수 없다. 하나의 연결 위에
 * 여러 룸(org:{orgId}, run:{runId})을 올려 각 훅이 필요한 룸만 join/leave 하게 한다.
 *
 * 토큰 갱신 대응: `auth`를 고정 값이 아니라 함수로 넘기면 socket.io가 (재)연결을 시도할 때마다
 * 이 함수를 다시 호출한다 — access token이 refresh로 바뀐 뒤에도 별도 배선 없이 항상 최신 토큰으로
 * 재연결된다(ARCHITECTURE.md 5장 "refresh 성공 시 socket.auth.token 갱신 후 재연결").
 */
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../stores/auth-store";

const WS_URL = import.meta.env.VITE_WS_URL ?? "http://localhost:3000";

let socket: Socket | null = null;

/** 아직 연결이 없으면 만들고(자동 연결 안 함), 있으면 재사용한다. */
export function getSocket(): Socket {
  socket ??= io(`${WS_URL}/realtime`, {
    transports: ["websocket"],
    autoConnect: false,
    auth: (callback) => {
      callback({ token: useAuthStore.getState().accessToken });
    },
  });
  return socket;
}

/** 로그인 후 최초 1회 또는 이미 연결된 경우 재사용. AppShell 마운트 시 호출된다. */
export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

/** 로그아웃 시 호출 — 다음 로그인에서 새 토큰으로 다시 연결되도록 완전히 끊는다. */
export function disconnectSocket(): void {
  socket?.disconnect();
}
