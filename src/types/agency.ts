export interface Agency {
  _id: string
  name: string
  commissionPercent: number
  createdAt?: string
  updatedAt?: string
}

export interface AgencyPayload {
  name: string
  commissionPercent: number
}
