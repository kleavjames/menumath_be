export type JwtPayload = {
  sub: string;
  username: string;
  tokenVersion: number;
};

export type AuthUser = {
  id: string;
  username: string;
};
