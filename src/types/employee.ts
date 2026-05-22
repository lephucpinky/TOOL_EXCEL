import { Department } from "./department"

export interface Employee {
  _id: string
  employeeName: string
  employeeEmail: string
  employeePhone: string
  departmentId: Department
  isActive?: boolean
}

export interface EmployeePayload {
  employeeName: string
  employeeEmail: string
  employeePhone: string
  departmentId: string
  isActive: boolean
}
