export type RefreshTokenReqType = {
  refresh_token: string;
};

export type ChangePasswordReqType = {
  old_password: string;
  new_password: string;
};

export type TokenDecode = {
  exp: number;
  iat: number;
  id: string;
  user_name: string;
  type: string;
};
