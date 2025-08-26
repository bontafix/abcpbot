import { loadEnv } from '../config/env';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import { chromium, Browser, Page } from 'playwright';
import * as path from 'path';
// import * as dayjs from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import customParseFormat from 'dayjs/plugin/customParseFormat';


loadEnv();
// Настройка dayjs
dayjs.locale('ru');
dayjs.extend(customParseFormat);

// Интерфейсы для типизации данных
interface Supplier {
    title: string;
    rs: string;
    bik: string;
    ks: string;
    inn: string;
}

interface Customer {
    // Добавьте необходимые поля для customer
    [key: string]: any;
}

interface InvoiceData {
    supplier: Supplier;
    customer: Customer;
    sum: number | string;
    comment?: string;
    stamp?: any;
    qrcode?: any;
    number: string;
    date: string;
}

interface InvoiceResult {
    url: string;
    customer: Customer;
    sum: number | string;
    comment?: string;
    stamp?: any;
    qrcode?: any;
    number: string;
    date: string;
    file: string;
    id: string;
}

interface Environment {
    PATH_LOCAL?: string;
    FILE_TEMPLATE: string;
    URL_DOWNLOAD: string;
    PATH_OUTPUT_STATIC: string;
}

// Функция для генерации QR-кода (заглушка, так как в оригинале не определена)
async function generateQRCode(text: string): Promise<string> {
    // Здесь должна быть реализация генерации QR-кода
    // Возвращаем пустую строку как заглушку
    return '';
}

// Функция для нормализации и конвертации суммы в строку
function normalizeAndConvertToString(sum: number | string): string {
    let sumStr = sum.toString();
    sumStr = sumStr.replace(',', '.');
    const parts = sumStr.split('.');
    let integerPart = parts[0];
    let decimalPart = parts[1] || '';
    
    if (decimalPart.length === 0) {
        return integerPart + '00';
    } else if (decimalPart.length === 1) {
        return integerPart + decimalPart + '0';
    } else {
        return integerPart + decimalPart.slice(0, 2);
    }
}

// Основная функция генерации PDF
export async function generatePdf(data: InvoiceData): Promise<InvoiceResult | undefined> {
    try {
        // Загрузка переменных окружения
        // const env: Environment = dotenv.config().parsed as Environment;
        const PATH_LOCAL = process.env.PATH_LOCAL || __dirname;
        const FILE_TEMPLATE = process.env.FILE_TEMPLATE || '';
        const URL_DOWNLOAD = process.env.URL_DOWNLOAD || '';
        const PATH_OUTPUT_STATIC = process.env.PATH_OUTPUT_STATIC || '';

        // Пути к изображениям
        const stampPath = `${PATH_LOCAL}/img/stamp.png`;
        const stampBase64 = fs.readFileSync(stampPath, { encoding: 'base64' });
        const stampDataUri = `data:image/png;base64,${stampBase64}`;

        const signaturePath = `${PATH_LOCAL}/img/sign.png`;
        const signatureBase64 = fs.readFileSync(signaturePath, { encoding: 'base64' });
        const signatureDataUri = `data:image/png;base64,${signatureBase64}`;

        const logoPath = `${PATH_LOCAL}/img/logo.png`;
        const logoBase64 = fs.readFileSync(logoPath, { encoding: 'base64' });
        const logoDataUri = `data:image/png;base64,${logoBase64}`;

        // Форматирование даты
        const formattedDate = dayjs(data.date, 'DD.MM.YYYY').format('D MMMM YYYY г.');
        console.log(formattedDate);
        console.log('<<<<<<<<<<<');

        // Подготовка данных для QR-кода
        const sum = normalizeAndConvertToString(data.sum);
        const idQr = 'ST00012';
        const dataQr = `${idQr}` +
            `|Name=${data.supplier.title.trim()}` +
            `|PersonalAcc=${data.supplier.rs.trim()}` +
            `|BIC=${data.supplier.bik.trim()}` +
            `|CorrespAcc=${data.supplier.ks.trim()}` +
            `|PayeeINN=${data.supplier.inn.trim()}` +
            `|Sum=${sum.trim()}`;

        // Генерация QR-кода
        const qrImage64 = await generateQRCode(dataQr) || '';
        const qrData = `data:image/png;base64,${qrImage64}`;

        const timestamp = Date.now();

        // Чтение HTML шаблона
        const templateHtml = fs.readFileSync( PATH_LOCAL + FILE_TEMPLATE, 'utf8');

        // Регистрация хелперов Handlebars
        Handlebars.registerHelper('increment', function (value: number): number {
            return value + 1;
        });

            Handlebars.registerHelper('isTrue', function (this: any, value: boolean, options: Handlebars.HelperOptions): any {
                return value === true ? options.fn(this) : options.inverse(this);
            });

        // Обработка комментария
        let compiledComment = '';
        if (data.comment && typeof data.comment === 'string') {
            compiledComment = Handlebars.compile(data.comment)({ data });
            console.log(compiledComment);
        } else {
            console.warn('data.comment is missing or not a string!');
        }

        // Компиляция основного шаблона
        const template = Handlebars.compile(templateHtml);

        const html = template({
            data: {
                ...data,
                stampBase64: stampDataUri,
                signatureBase64: signatureDataUri,
                logoBase64: logoDataUri,
                qrImage64: qrImage64,
                formattedDate: formattedDate,
                comment: compiledComment,
            },
        });

        // Гарантируем существование каталога для вывода
        const outputDir = path.isAbsolute(PATH_OUTPUT_STATIC)
            ? PATH_OUTPUT_STATIC
            : path.resolve(process.cwd(), PATH_OUTPUT_STATIC);
        try {
            fs.mkdirSync(outputDir, { recursive: true });
        } catch {}

        // Сохранение HTML файла
        const htmlPath = path.join(outputDir, `${data.number}-${timestamp}.html`);
        fs.writeFileSync(htmlPath, html, 'utf8');
        console.log(`HTML файл сохранен: ${htmlPath}`);

        // Генерация PDF с помощью Playwright
        const browser: Browser = await chromium.launch();
        const page: Page = await browser.newPage();
        await page.setContent(html);
        
        const fileName = `${data.number}-${timestamp}.pdf`;
        const pathSave = path.join(outputDir, fileName);
        
        await page.pdf({
            path: pathSave,
            format: 'A4',
            margin: {
                top: '100px',
                bottom: '40px',
                left: '0px',
                right: '0px'
            }
        });

        await browser.close();

        // Возврат результата
        return {
            url: `${URL_DOWNLOAD}${fileName}`,
            customer: data.customer,
            sum: data.sum,
            comment: data.comment,
            stamp: data.stamp,
            qrcode: data.qrcode,
            number: data.number,
            date: data.date,
            file: fileName,
            id: data.number
        };

    } catch (error) {
        console.log(error);
        return undefined;
    }
}
