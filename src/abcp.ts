import axios from 'axios';


// exports.searchCompanies = async (url:string, key:string, query: string) => {
export async function searchBrands(host: string, user: string, pass: string, number: string) {
    try {
        const axios = require('axios');
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
    host: string,
    user: string,
    pass: string,
    number: string,
    brand: string, 
     ) {
    try {
        const axios = require('axios');

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
            return response?.data;
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