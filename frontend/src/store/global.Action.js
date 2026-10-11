import { createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '@/lib/api';

export const CreateRoom = createAsyncThunk('globalState/createRoom', async (_, { rejectWithValue }) => {
    try {
        return await api.createRoom();
    } catch (err) {
        return rejectWithValue(err.message);
    }
});

export const CheckRoom = createAsyncThunk('globalState/checkRoom', async (code, { rejectWithValue }) => {
    try {
        return await api.room(code);
    } catch (err) {
        return rejectWithValue(err.message);
    }
});
