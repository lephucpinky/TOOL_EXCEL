export interface Bank {
  _id: string
  inv_buyerBankName: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
  __v?: number
}

export interface BankPayload {
  inv_buyerBankName: string
  isActive: boolean
}
