import { configureStore } from '@reduxjs/toolkit';
import ContactCbtReducer from './slices/ContactCbtSlice'
import aboutUsReducer from './slices/aboutUsSlice';
import authReducer from './slices/authSlice';
import modeReducer from './slices/modeSlice'

export const store = configureStore({
  reducer: {
    ContactCbt: ContactCbtReducer,
    auth: authReducer,
     aboutUs: aboutUsReducer,
     mode: modeReducer,

   
 
    
  },
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
