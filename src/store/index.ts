import { configureStore } from "@reduxjs/toolkit"

import { agencyReducer } from "@/store/slices/agencySlice"
import { authReducer } from "@/store/slices/authSlice"
import { bankReducer } from "@/store/slices/bankSlice"
import { departmentReducer } from "@/store/slices/departmentSlice"
import { employeeReducer } from "@/store/slices/employeeSlice"
import { productReducer } from "@/store/slices/productSlice"
import { saleTransactionReducer } from "@/store/slices/saleTransactionSlice"

export const store = configureStore({
  reducer: {
    auth: authReducer,
    agencies: agencyReducer,
    departments: departmentReducer,
    employees: employeeReducer,
    products: productReducer,
    banks: bankReducer,
    saleTransactions: saleTransactionReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export type AppStore = typeof store
