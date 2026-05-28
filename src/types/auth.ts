export interface LoginPayload {
  username: string
  password: string
}

export interface ChangePasswordPayload {
  oldPassword: string
  newPassword: string
}

export interface LoginResponse {
  code?: number
  message?: string
  content?: {
    access_token?: string
    accessToken?: string
    refresh_token?: string
    refreshToken?: string
  }
}
