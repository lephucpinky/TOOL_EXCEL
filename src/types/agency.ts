import { Employee } from "./employee"

export interface Agency {
  _id: string
  agencyNumber?: string
  agencyName: string
  agencyEmail?: string
  commissionPercent: number
  employeeId: Employee
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AgencyPayload {
  agencyName: string
  employeeId: string
  commissionPercent: number
}
