import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 64,
    maxFreeSockets: 32,
    timeout: 30000,
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 64,
    maxFreeSockets: 32,
    timeout: 30000,
});

export const httpClient: AxiosInstance = axios.create({
    timeout: 15000,
    httpAgent,
    httpsAgent,
});

// Логирование длительности запросов
httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    (config as any).metadata = { start: Date.now() };
    return config;
});

httpClient.interceptors.response.use(
    (response: AxiosResponse) => {
        const meta = (response.config as any).metadata;
        const durationMs = meta && meta.start ? Date.now() - meta.start : undefined;
        if (durationMs !== undefined) {
            // Уровень логирования можно заменить на ваш
            // console.log(`[HTTP] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} - ${durationMs}ms`);
        }
        return response;
    },
    (error: any) => {
        const config = error?.config || {};
        const meta = (config as any).metadata;
        const durationMs = meta && meta.start ? Date.now() - meta.start : undefined;
        // console.error(`[HTTP] ERROR ${config?.method?.toUpperCase?.() || ''} ${config?.url || ''} - ${durationMs ?? '?'}ms`, error?.message);
        return Promise.reject(error);
    }
);

export { axios };

