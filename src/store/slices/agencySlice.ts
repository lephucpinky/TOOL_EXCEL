import { Agency, AgencyPayload } from "@/types/agency"
import {
  APICreateAgency,
  APIDeleteAgency,
  APIGetAgencies,
  APIGetAgencyById,
  APIUpdateAgency,
} from "@/services/agency"
import { createCrudModule } from "@/store/utils/crud"

export const agencyModule = createCrudModule<Agency, AgencyPayload>({
  name: "agencies",
  fetchAll: APIGetAgencies,
  fetchById: APIGetAgencyById,
  createItem: APICreateAgency,
  updateItem: APIUpdateAgency,
  deleteItem: APIDeleteAgency,
  selectId: (item) => item._id,
})

export const agencyReducer = agencyModule.reducer
export const agencyActions = agencyModule.actions
export const agencyThunks = agencyModule.thunks
