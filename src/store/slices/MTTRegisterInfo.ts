
import { MTTRegisterInfo } from '@/types/MTTRegisterInfo';
import { createSlice} from '@reduxjs/toolkit';

// Giá trị mặc định của state
const initialState = {
    MTTRegister: <MTTRegisterInfo[]>[
   {
      contact_info: {
        name: "",
        phone_number: "",
      },
      mtt_register_info: {
        register_info_image: [],
        id_card_image: [],
        cks_image: [],
        
      },
      status: "",
    },
  ],
};

export const MTTRegisterSlice = createSlice({
  name: 'mtt-register',
  initialState,
  reducers: {
    setMTTRegister: (state, action) => {
      state.MTTRegister = action.payload;
    },
    clearMTTRegister: (state) => {
      state.MTTRegister = initialState.MTTRegister;
    },
  },
});

export const { setMTTRegister, clearMTTRegister } = MTTRegisterSlice.actions;

export default MTTRegisterSlice.reducer;
