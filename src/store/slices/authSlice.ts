import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"

import { APILogin } from "@/services/auth"
import { LoginPayload } from "@/types/auth"
import { getErrorMessage } from "@/store/utils/crud"

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  username: string | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
}

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  username: null,
  isAuthenticated: false,
  loading: false,
  error: null,
}

export const loginThunk = createAsyncThunk(
  "auth/login",
  async (payload: LoginPayload) => {
    const response = await APILogin(payload)

    return {
      accessToken: response?.access_token || response?.accessToken || null,
      refreshToken: response?.refresh_token || response?.refreshToken || null,
      username:
        response?.username ||
        response?.userName ||
        response?.user?.username ||
        payload.username,
    }
  }
)

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    hydrateAuth(
      state,
      action: {
        payload: {
          accessToken?: string | null
          refreshToken?: string | null
          username?: string | null
        }
      }
    ) {
      state.accessToken = action.payload.accessToken || null
      state.refreshToken = action.payload.refreshToken || null
      state.username = action.payload.username || null
      state.isAuthenticated = Boolean(action.payload.accessToken)
    },
    logout(state) {
      state.accessToken = null
      state.refreshToken = null
      state.username = null
      state.isAuthenticated = false
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false
        state.accessToken = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
        state.username = action.payload.username
        state.isAuthenticated = Boolean(action.payload.accessToken)
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false
        state.error = getErrorMessage(action.error)
      })
  },
})

export const authReducer = authSlice.reducer
export const authActions = authSlice.actions
