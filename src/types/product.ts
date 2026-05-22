export interface Product {
  _id: string
  inv_itemCode: string
  inv_itemName: string
  inv_unitCode: string
  inv_unitPrice: number
  inv_quantity: number
  inv_discountAmount: number
  ma_thue: string
}

export interface ProductPayload {
  inv_itemName: string
  inv_unitCode: string
  inv_unitPrice: number
  inv_quantity: number
  inv_discountAmount: number
  ma_thue: string
}
