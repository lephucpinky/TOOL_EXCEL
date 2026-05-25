import { Product, ProductPayload } from "@/types/product"
import {
  APICreateProduct,
  APIDeleteProduct,
  APIGetProductById,
  APIGetProducts,
  APIUpdateProduct,
} from "@/services/product"
import { createCrudModule } from "@/store/utils/crud"

export const productModule = createCrudModule<Product, ProductPayload>({
  name: "products",
  fetchAll: APIGetProducts,
  fetchById: APIGetProductById,
  createItem: APICreateProduct,
  updateItem: APIUpdateProduct,
  deleteItem: APIDeleteProduct,
  selectId: (item) => item._id,
})

export const productReducer = productModule.reducer
export const productActions = productModule.actions
export const productThunks = productModule.thunks
