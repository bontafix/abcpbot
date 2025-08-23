import axios from 'axios';
import { transformAvailability } from './utils/availability';

// In-memory кэш для getDistributors с дедупликацией параллельных запросов
let distributorsCache: any[] | null = null;
let distributorsCacheExpiresAt = 0; // ms timestamp
let distributorsFetchPromise: Promise<any[]> | null = null;


// exports.searchCompanies = async (url:string, key:string, query: string) => {
export async function searchBrands(number: string) {
    try {
        const host = process.env.ABCP_HOST;
        const user = process.env.ABCP_USER;
        const pass = process.env.ABCP_PASS;
        if (!host || !user || !pass) {
            console.error('ABCP env vars are not set');
            return [];
        }
        const url = `https://${host}/search/brands?userlogin=${user}&userpsw=${pass}&number=${number}`
        // console.log(url)

        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: url,
            headers: {}
        };
        const response = await axios.request(config)
        const result: any = []
        if (response?.data !== 0) {
            return (response?.data)
        } else {
            console.error(`артикул ${number}, не найден`);
            return ([]);
        }
    } catch (error: any) {
        console.error('Ошибка при выполнении запроса:', error?.response?.data);
        // console.error(error)
        console.error(error?.response?.data)
        console.error(error?.status)
        return ([]);
    }
}

export async function searchArticles(
    number: string,
    brand: string, 
     ) {
    try {
        const host = process.env.ABCP_HOST;
        const user = process.env.ABCP_USER;
        const pass = process.env.ABCP_PASS;
        if (!host || !user || !pass) {
            console.error('ABCP env vars are not set');
            return [];
        }

        const url = `https://${host}/search/articles?userlogin=${user}&userpsw=${pass}&number=${number}&brand=${brand}&useOnlineStocks=1`;
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: url,
            headers: {}
        };
        const response = await axios.request(config);
        // console.log(response?.data);
        if (response?.data !== 0) {
            const data = response?.data as any;
            if (Array.isArray(data)) {
                // Добавим поле с преобразованным availability, сохранив исходное
                return data.map((item) => ({
                    ...item,
                    availabilityTransformed: transformAvailability(item?.availability),
                }));
            }
            return data;
        } else {
            console.error(`артикул ${number}, не найден`);
            return [];
        }
    } catch (error: any) {
        console.error('Ошибка при выполнении запроса:', error.message);
        console.error(error?.response?.data)
        console.error(error?.status)
        return [];
    }
}

export async function getDistributors() {
    try {
        const now = Date.now();
        const ttlSeconds = Number(process.env.DISTRIBUTORS_TTL_SECONDS ?? 300);

        // Вернем из кэша, если валиден
        if (distributorsCache && now < distributorsCacheExpiresAt) {
            return distributorsCache;
        }

        // Дедупликация одновременных запросов
        if (distributorsFetchPromise) {
            return await distributorsFetchPromise;
        }

        const host = process.env.ABCP_HOST;
        const user = process.env.ABCP_USER;
        const pass = process.env.ABCP_PASS;
        if (!host || !user || !pass) {
            console.error('ABCP env vars are not set');
            return [];
        }
        const url = `https://${host}/cp/distributors?userlogin=${user}&userpsw=${pass}`;
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: url,
            headers: {}
        };

        // Начинаем фоновый запрос и расшариваем промис
        distributorsFetchPromise = (async () => {
            const response = await axios.request(config);
            if (response?.data !== 0) {
                const data = response?.data as any[];
                // Успешный ответ — запишем в кэш
                distributorsCache = data;
                distributorsCacheExpiresAt = Date.now() + ttlSeconds * 1000;
                return data;
            } else {
                console.error('дистрибьюторы не найдены');
                return [];
            }
        })();

        try {
            const data = await distributorsFetchPromise;
            return data;
        } finally {
            distributorsFetchPromise = null;
        }
    } catch (error: any) {
        console.error('Ошибка при выполнении запроса:', error.message);
        console.error(error?.response?.data)
        console.error(error?.status)
        return [];
    }
}