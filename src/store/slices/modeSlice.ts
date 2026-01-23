// 'use client'
import { createSlice } from "@reduxjs/toolkit"

const initialState = {
  modeInfo: {
    mode: "create",
  },
}

const createModeSlice = createSlice({
  name: "modeSlice",
  initialState,
  reducers: {
    setMode: (state, action) => {
      state.modeInfo.mode = action.payload.mode || state.modeInfo.mode
    },
  },
})

export const { setMode } = createModeSlice.actions
export default createModeSlice.reducer
