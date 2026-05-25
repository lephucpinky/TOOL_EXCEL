import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"

import {
  APICreateSaleTransaction,
  APIDeleteSaleTransaction,
  APIGetSaleTransactionById,
  APIGetSaleTransactions,
  APIUpdateSaleTransaction,
  APIUpdateSaleTransactionBank,
} from "@/services/saleTransaction"
import { InvoiceApiRow } from "@/types/invoice"
import { getErrorMessage } from "@/store/utils/crud"

type SaleTransactionState = {
  items: InvoiceApiRow[]
  current: InvoiceApiRow | null
  loading: boolean
  detailLoading: boolean
  submitLoading: boolean
  deleteLoading: boolean
  initialized: boolean
  error: string | null
}

const initialState: SaleTransactionState = {
  items: [],
  current: null,
  loading: false,
  detailLoading: false,
  submitLoading: false,
  deleteLoading: false,
  initialized: false,
  error: null,
}

function normalizeList(response: any): InvoiceApiRow[] {
  const raw = response?.data ?? []

  if (Array.isArray(raw)) return raw
  if (Array.isArray(raw?.items)) return raw.items
  if (Array.isArray(raw?.docs)) return raw.docs
  if (Array.isArray(raw?.results)) return raw.results
  if (Array.isArray(raw?.saleTransactions)) return raw.saleTransactions
  if (Array.isArray(raw?.transactions)) return raw.transactions

  return []
}

function normalizeDetail(response: any): InvoiceApiRow | null {
  const detail = response?.data ?? null
  return detail?._id ? detail : null
}

function upsertTransaction(items: InvoiceApiRow[], item: InvoiceApiRow) {
  const index = items.findIndex((existing) => existing._id === item._id)

  if (index === -1) {
    items.unshift(item)
    return
  }

  items[index] = item
}

export const fetchSaleTransactionsThunk = createAsyncThunk(
  "saleTransactions/fetchAll",
  async (params?: any) => {
    const response = await APIGetSaleTransactions(params)
    return normalizeList(response)
  }
)

export const fetchSaleTransactionByIdThunk = createAsyncThunk(
  "saleTransactions/fetchById",
  async (id: string) => {
    const response = await APIGetSaleTransactionById(id)
    return normalizeDetail(response)
  }
)

export const createSaleTransactionThunk = createAsyncThunk(
  "saleTransactions/create",
  async (payload: any) => {
    const response = await APICreateSaleTransaction(payload)
    return normalizeDetail(response)
  }
)

export const updateSaleTransactionThunk = createAsyncThunk(
  "saleTransactions/update",
  async ({ id, payload }: { id: string; payload: any }) => {
    const response = await APIUpdateSaleTransaction(id, payload)
    return normalizeDetail(response)
  }
)

export const updateSaleTransactionBankThunk = createAsyncThunk(
  "saleTransactions/updateBank",
  async ({ id, bankId }: { id: string; bankId: string }) => {
    const response = await APIUpdateSaleTransactionBank(id, { bankId })
    return normalizeDetail(response)
  }
)

export const deleteSaleTransactionThunk = createAsyncThunk(
  "saleTransactions/delete",
  async (id: string) => {
    await APIDeleteSaleTransaction(id)
    return id
  }
)

const saleTransactionSlice = createSlice({
  name: "saleTransactions",
  initialState,
  reducers: {
    clearCurrentSaleTransaction(state) {
      state.current = null
    },
    resetSaleTransactionState() {
      return initialState
    },
    setCurrentSaleTransaction(state, action: { payload: InvoiceApiRow | null }) {
      state.current = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSaleTransactionsThunk.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSaleTransactionsThunk.fulfilled, (state, action) => {
        state.loading = false
        state.initialized = true
        state.items = action.payload
      })
      .addCase(fetchSaleTransactionsThunk.rejected, (state, action) => {
        state.loading = false
        state.error = getErrorMessage(action.error)
      })
      .addCase(fetchSaleTransactionByIdThunk.pending, (state) => {
        state.detailLoading = true
        state.error = null
      })
      .addCase(fetchSaleTransactionByIdThunk.fulfilled, (state, action) => {
        state.detailLoading = false
        state.current = action.payload
        if (action.payload) {
          upsertTransaction(state.items, action.payload)
        }
      })
      .addCase(fetchSaleTransactionByIdThunk.rejected, (state, action) => {
        state.detailLoading = false
        state.error = getErrorMessage(action.error)
      })
      .addCase(createSaleTransactionThunk.pending, (state) => {
        state.submitLoading = true
        state.error = null
      })
      .addCase(createSaleTransactionThunk.fulfilled, (state, action) => {
        state.submitLoading = false
        state.current = action.payload
        if (action.payload) {
          upsertTransaction(state.items, action.payload)
        }
      })
      .addCase(createSaleTransactionThunk.rejected, (state, action) => {
        state.submitLoading = false
        state.error = getErrorMessage(action.error)
      })
      .addCase(updateSaleTransactionThunk.pending, (state) => {
        state.submitLoading = true
        state.error = null
      })
      .addCase(updateSaleTransactionThunk.fulfilled, (state, action) => {
        state.submitLoading = false
        state.current = action.payload
        if (action.payload) {
          upsertTransaction(state.items, action.payload)
        }
      })
      .addCase(updateSaleTransactionThunk.rejected, (state, action) => {
        state.submitLoading = false
        state.error = getErrorMessage(action.error)
      })
      .addCase(updateSaleTransactionBankThunk.pending, (state) => {
        state.submitLoading = true
        state.error = null
      })
      .addCase(updateSaleTransactionBankThunk.fulfilled, (state, action) => {
        state.submitLoading = false
        state.current = action.payload
        if (action.payload) {
          upsertTransaction(state.items, action.payload)
        }
      })
      .addCase(updateSaleTransactionBankThunk.rejected, (state, action) => {
        state.submitLoading = false
        state.error = getErrorMessage(action.error)
      })
      .addCase(deleteSaleTransactionThunk.pending, (state) => {
        state.deleteLoading = true
        state.error = null
      })
      .addCase(deleteSaleTransactionThunk.fulfilled, (state, action) => {
        state.deleteLoading = false
        state.items = state.items.filter((item) => item._id !== action.payload)
        if (state.current?._id === action.payload) {
          state.current = null
        }
      })
      .addCase(deleteSaleTransactionThunk.rejected, (state, action) => {
        state.deleteLoading = false
        state.error = getErrorMessage(action.error)
      })
  },
})

export const saleTransactionReducer = saleTransactionSlice.reducer
export const saleTransactionActions = saleTransactionSlice.actions
