import { Employee, EmployeePayload } from "@/types/employee"
import {
  APICreateEmployee,
  APIDeleteEmployee,
  APIGetEmployeeById,
  APIGetEmployees,
  APIUpdateEmployee,
} from "@/services/employee"
import { createCrudModule } from "@/store/utils/crud"

export const employeeModule = createCrudModule<Employee, EmployeePayload>({
  name: "employees",
  fetchAll: APIGetEmployees,
  fetchById: APIGetEmployeeById,
  createItem: APICreateEmployee,
  updateItem: APIUpdateEmployee,
  deleteItem: APIDeleteEmployee,
  selectId: (item) => item._id,
})

export const employeeReducer = employeeModule.reducer
export const employeeActions = employeeModule.actions
export const employeeThunks = employeeModule.thunks
