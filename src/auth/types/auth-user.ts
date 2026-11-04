export type JwtPayload = {
  sub: string;
  username: string;
  sid: string;
  deviceId: string;
};

export type AuthUser = {
  id: string;
  username: string;
  sessionId: string;
};
