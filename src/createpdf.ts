import axios, { AxiosRequestConfig } from 'axios';
import { InvoiceData, InvoiceApiResponse } from './types/invoice'; 

export async function createInvoicePdf(data: InvoiceData): Promise<string> {
    try {
        const config: AxiosRequestConfig = {
            method: 'post',
            maxBodyLength: Infinity,
            // url: 'https://dev.unamp.io/invoice',
            url: 'https://invoice.unamp.io/invoice',
            headers: {
              'x-api-key': '20b3cee0-1549-4bf7-ad8b-49e74a8a9778', // Укажите ваш API-ключ
              'Content-Type': 'application/json',
              'Authorization': 'Bearer 12345', // Укажите Bearer-токен
            },
            data: JSON.stringify(data),
          };
        //   const response = await axios.request<InvoiceApiResponse>(config);
          const response = await axios.request(config);
        //   console.log('Ответ API:', response.data);
          return response.data.data.url;
    } catch (error: any ) {
        console.error('Ошибка при запросе к API:', error.message);
        throw new Error('Произошла ошибка при генерации PDF. Пожалуйста, попробуйте позже.');
        // await ctx.reply('Произошла ошибка при генерации PDF. Пожалуйста, попробуйте позже.');
    }

}
