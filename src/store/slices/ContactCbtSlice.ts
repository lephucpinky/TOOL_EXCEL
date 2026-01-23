import { ContactCbt } from "@/types/ContactCbt";
import { createSlice } from "@reduxjs/toolkit";



// Giá trị mặc định của state
const initialState = {
    ContactCbt: <ContactCbt[]>[
   {
      phone_number: ""
    },
  ],
};

export const ContactCbtSlice = createSlice({
  name: 'ContactCbt',
  initialState,
  reducers: {
    setContactCbt: (state, action) => {
      state.ContactCbt = action.payload;
    },
    clearContactCbt: (state) => {
      state.ContactCbt = initialState.ContactCbt;
    },
  },
});

export const { setContactCbt, clearContactCbt } = ContactCbtSlice.actions;

export default ContactCbtSlice.reducer;
