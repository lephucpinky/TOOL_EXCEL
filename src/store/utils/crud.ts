import {
  ActionReducerMapBuilder,
  AsyncThunk,
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit"

export type CrudStatus = "idle" | "loading" | "succeeded" | "failed"

export type CrudState<TItem> = {
  items: TItem[]
  current: TItem | null
  loading: boolean
  detailLoading: boolean
  submitLoading: boolean
  deleteLoading: boolean
  initialized: boolean
  error: string | null
  status: CrudStatus
}

type CrudServiceResponse<TItem> = {
  data?: TItem | TItem[] | null
  status?: number
}

type CrudConfig<TItem, TPayload> = {
  name: string
  fetchAll: (params?: any) => Promise<CrudServiceResponse<TItem>>
  fetchById: (id: string) => Promise<CrudServiceResponse<TItem>>
  createItem: (payload: TPayload) => Promise<CrudServiceResponse<TItem>>
  updateItem: (
    id: string,
    payload: TPayload
  ) => Promise<CrudServiceResponse<TItem>>
  deleteItem: (id: string) => Promise<CrudServiceResponse<TItem>>
  selectId: (item: TItem) => string
}

function normalizeList<TItem>(value: unknown): TItem[] {
  if (Array.isArray(value)) return value as TItem[]
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>

    if (Array.isArray(candidate.items)) return candidate.items as TItem[]
    if (Array.isArray(candidate.docs)) return candidate.docs as TItem[]
    if (Array.isArray(candidate.results)) return candidate.results as TItem[]
    if (Array.isArray(candidate.data)) return candidate.data as TItem[]
  }

  return []
}

function normalizeItem<TItem>(value: unknown): TItem | null {
  if (!value || Array.isArray(value)) return null
  return value as TItem
}

export function getErrorMessage(error: unknown) {
  const candidate = error as
    | {
        response?: { data?: { message?: string | string[]; error?: string } }
        message?: string
      }
    | undefined

  const responseMessage = candidate?.response?.data?.message

  if (Array.isArray(responseMessage)) {
    return responseMessage.join(", ")
  }

  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage
  }

  if (typeof candidate?.response?.data?.error === "string") {
    return candidate.response.data.error
  }

  if (typeof candidate?.message === "string") {
    return candidate.message
  }

  return "Có lỗi xảy ra."
}

function buildInitialState<TItem>(): CrudState<TItem> {
  return {
    items: [],
    current: null,
    loading: false,
    detailLoading: false,
    submitLoading: false,
    deleteLoading: false,
    initialized: false,
    error: null,
    status: "idle",
  }
}

function upsertItem<TItem>(
  items: TItem[],
  item: TItem,
  selectId: (value: TItem) => string
) {
  const nextId = selectId(item)
  const index = items.findIndex((existing) => selectId(existing) === nextId)

  if (index === -1) {
    items.unshift(item)
    return
  }

  items[index] = item
}

function removeItem<TItem>(
  items: TItem[],
  id: string,
  selectId: (value: TItem) => string
) {
  return items.filter((item) => selectId(item) !== id)
}

export function createCrudModule<TItem, TPayload>(config: CrudConfig<TItem, TPayload>) {
  const fetchAll = createAsyncThunk(`${config.name}/fetchAll`, async (params?: any) => {
    const response = await config.fetchAll(params)
    return normalizeList<TItem>(response?.data)
  })

  const fetchById = createAsyncThunk(`${config.name}/fetchById`, async (id: string) => {
    const response = await config.fetchById(id)
    return normalizeItem<TItem>(response?.data)
  })

  const createItem = createAsyncThunk(
    `${config.name}/createItem`,
    async (payload: TPayload) => {
      const response = await config.createItem(payload)
      return normalizeItem<TItem>(response?.data)
    }
  )

  const updateItem = createAsyncThunk(
    `${config.name}/updateItem`,
    async ({ id, payload }: { id: string; payload: TPayload }) => {
      const response = await config.updateItem(id, payload)
      return normalizeItem<TItem>(response?.data)
    }
  )

  const deleteItem = createAsyncThunk(`${config.name}/deleteItem`, async (id: string) => {
    await config.deleteItem(id)
    return id
  })

  const slice = createSlice({
    name: config.name,
    initialState: buildInitialState<TItem>(),
    reducers: {
      clearCurrent(state) {
        state.current = null
      },
      resetState() {
        return buildInitialState<TItem>()
      },
      setCurrent(state, action: { payload: TItem | null }) {
        state.current = action.payload as any
      },
    },
    extraReducers: (builder) => {
      buildCrudReducers(builder, {
        fetchAll,
        fetchById,
        createItem,
        updateItem,
        deleteItem,
        selectId: config.selectId,
      })
    },
  })

  return {
    reducer: slice.reducer,
    actions: slice.actions,
    thunks: {
      fetchAll,
      fetchById,
      createItem,
      updateItem,
      deleteItem,
    },
  }
}

function buildCrudReducers<TItem>(
  builder: ActionReducerMapBuilder<CrudState<TItem>>,
  config: {
    fetchAll: AsyncThunk<TItem[], any, any>
    fetchById: AsyncThunk<TItem | null, string, any>
    createItem: AsyncThunk<TItem | null, any, any>
    updateItem: AsyncThunk<TItem | null, { id: string; payload: any }, any>
    deleteItem: AsyncThunk<string, string, any>
    selectId: (item: TItem) => string
  }
) {
  builder
    .addCase(config.fetchAll.pending, (state) => {
      state.loading = true
      state.error = null
      state.status = "loading"
    })
    .addCase(config.fetchAll.fulfilled, (state, action) => {
      state.loading = false
      state.initialized = true
      state.items = action.payload as any
      state.status = "succeeded"
    })
    .addCase(config.fetchAll.rejected, (state, action) => {
      state.loading = false
      state.error = getErrorMessage(action.error)
      state.status = "failed"
    })
    .addCase(config.fetchById.pending, (state) => {
      state.detailLoading = true
      state.error = null
    })
    .addCase(config.fetchById.fulfilled, (state, action) => {
      state.detailLoading = false
      state.current = action.payload as any
      if (action.payload) {
        upsertItem(state.items as any, action.payload as any, config.selectId)
      }
    })
    .addCase(config.fetchById.rejected, (state, action) => {
      state.detailLoading = false
      state.error = getErrorMessage(action.error)
    })
    .addCase(config.createItem.pending, (state) => {
      state.submitLoading = true
      state.error = null
    })
    .addCase(config.createItem.fulfilled, (state, action) => {
      state.submitLoading = false
      if (action.payload) {
        state.current = action.payload as any
        upsertItem(state.items as any, action.payload as any, config.selectId)
      }
    })
    .addCase(config.createItem.rejected, (state, action) => {
      state.submitLoading = false
      state.error = getErrorMessage(action.error)
    })
    .addCase(config.updateItem.pending, (state) => {
      state.submitLoading = true
      state.error = null
    })
    .addCase(config.updateItem.fulfilled, (state, action) => {
      state.submitLoading = false
      if (action.payload) {
        state.current = action.payload as any
        upsertItem(state.items as any, action.payload as any, config.selectId)
      }
    })
    .addCase(config.updateItem.rejected, (state, action) => {
      state.submitLoading = false
      state.error = getErrorMessage(action.error)
    })
    .addCase(config.deleteItem.pending, (state) => {
      state.deleteLoading = true
      state.error = null
    })
    .addCase(config.deleteItem.fulfilled, (state, action) => {
      state.deleteLoading = false
      state.items = removeItem(state.items as any, action.payload, config.selectId) as any
      if (state.current && config.selectId(state.current as any) === action.payload) {
        state.current = null
      }
    })
    .addCase(config.deleteItem.rejected, (state, action) => {
      state.deleteLoading = false
      state.error = getErrorMessage(action.error)
    })
}
