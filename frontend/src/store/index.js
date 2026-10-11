import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import globalReducer from './global.Slice';

const storage = {
    getItem: (key) => Promise.resolve(window.localStorage.getItem(key)),
    setItem: (key, value) => Promise.resolve(window.localStorage.setItem(key, value)),
    removeItem: (key) => Promise.resolve(window.localStorage.removeItem(key)),
};

const persistConfig = {
    key: 'dream-craft',
    storage,
    /* Only who you are and where you were — never live world state. */
    whitelist: ['profile', 'lastRoom'],
};

export const store = configureStore({
    reducer: {
        global: persistReducer(persistConfig, globalReducer),
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: { ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'] },
            immutableCheck: false,
        }),
});

export const persistor = persistStore(store);
