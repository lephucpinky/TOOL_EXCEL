export type UserRole = "ADMIN" | "USER"

export interface UserAccount {
  _id?: string
  id?: string
  username?: string
  userName?: string
  email?: string
  role?: UserRole | string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}
