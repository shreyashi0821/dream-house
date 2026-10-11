import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { Toaster } from 'react-hot-toast';
import { store, persistor } from '@/store';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
                <App />
                <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'Fredoka, sans-serif', borderRadius: 14 } }} />
            </PersistGate>
        </Provider>
    </React.StrictMode>
);
