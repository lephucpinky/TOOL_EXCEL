export interface Department {
  _id: string
  departmentNumber?: string
  departmentName: string
  departmentDescription: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
  __v?: number
}

export interface DepartmentPayload {
  departmentName: string
  departmentDescription: string
  isActive: boolean
}
