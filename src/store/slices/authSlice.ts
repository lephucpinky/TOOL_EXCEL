import { TokenDecode } from '@/types/auth';

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Giá trị mặc định của state
const initialState = {
  tokenDecode: <TokenDecode>{
    id: '',
    type: '',
    user_name: '',
    exp: 0,
    iat: 0,
  },
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setTokenDecode: (state, action) => {
      state.tokenDecode = action.payload;
    },
    clearTokenDecode: (state) => {
      state.tokenDecode = initialState.tokenDecode;
    },
  },
});

export const { setTokenDecode, clearTokenDecode } = authSlice.actions;

export default authSlice.reducer;
