import axios from 'axios';

/* Empty means "the server that served this page" — true in dev (Vite proxies
   to the backend) and in production (the backend serves the built app). */
export const baseURL = import.meta.env.VITE_SERVER_URL || '';

const axiosInstance = axios.create({ baseURL, timeout: 10_000 });

axiosInstance.interceptors.response.use(
    (res) => res,
    (err) => {
        const message = err?.response?.data?.message;
        if (message) console.log(message);
        throw err;
    }
);

export default axiosInstance;
