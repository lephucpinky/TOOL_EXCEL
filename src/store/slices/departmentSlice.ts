import { Department, DepartmentPayload } from "@/types/department"
import {
  APICreateDepartment,
  APIDeleteDepartment,
  APIGetDepartmentById,
  APIGetDepartments,
  APIUpdateDepartment,
} from "@/services/department"
import { createCrudModule } from "@/store/utils/crud"

export const departmentModule = createCrudModule<
  Department,
  DepartmentPayload
>({
  name: "departments",
  fetchAll: APIGetDepartments,
  fetchById: APIGetDepartmentById,
  createItem: APICreateDepartment,
  updateItem: APIUpdateDepartment,
  deleteItem: APIDeleteDepartment,
  selectId: (item) => item._id,
})

export const departmentReducer = departmentModule.reducer
export const departmentActions = departmentModule.actions
export const departmentThunks = departmentModule.thunks
