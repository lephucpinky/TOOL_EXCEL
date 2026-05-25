import { Bank, BankPayload } from "@/types/bank"
import {
  APICreateBank,
  APIDeleteBank,
  APIGetBankById,
  APIGetBanks,
  APIUpdateBank,
} from "@/services/bank"
import { createCrudModule } from "@/store/utils/crud"

export const bankModule = createCrudModule<Bank, BankPayload>({
  name: "banks",
  fetchAll: APIGetBanks,
  fetchById: APIGetBankById,
  createItem: APICreateBank,
  updateItem: APIUpdateBank,
  deleteItem: APIDeleteBank,
  selectId: (item) => item._id,
})

export const bankReducer = bankModule.reducer
export const bankActions = bankModule.actions
export const bankThunks = bankModule.thunks
