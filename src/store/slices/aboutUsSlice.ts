import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Giá trị mặc định của state
const initialState = {
  aboutUs: {
    _id: '',
    company_name: '',
    logo: '',
    description: '',
    slogan: '',
    history: {
      description: '',
      image: '',
    },
    open_time: '',
    vision: {
      description: '',
      image: '',
    },
    mission: {
      description: '',
      image: '',
    },
    address: '',
    phone: '',
    email: '',
    facebook_link: '',
    tiktok_link: '',
    zalo_link: '',
    youtube_link: '',
    map: '',
    banner: '',
    image_delete: [],
    core_values: {
      title: '',
      description: '',
      image: '',
      value_item: [
        {
          title: '',
          description: '',
        },
      ],
    },
    button_action: [],
  },
};

export const aboutUsSlice = createSlice({
  name: 'aboutUs',
  initialState,
  reducers: {
    setAboutUs: (state, action) => {
      state.aboutUs = action.payload;
    },
    clearAboutUs: (state) => {
      state.aboutUs = initialState.aboutUs;
    },
  },
});

export const { setAboutUs, clearAboutUs } = aboutUsSlice.actions;

export default aboutUsSlice.reducer;
