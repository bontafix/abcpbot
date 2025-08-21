// types/invoice.ts

// Типизация для поставщика (supplier)
export interface Supplier {
    inn: string; // ИНН поставщика
    kpp: string; // КПП поставщика
    title: string; // Название поставщика
    rs: string; // Расчётный счёт
    bank: string; // Банк поставщика
    ks: string; // Корреспондентский счёт
    head: string; // Руководитель
    booker?: string; // Бухгалтер (опционально)
    bik: string; // БИК
  }
  
  // Типизация для клиента (customer)
  export interface Customer {
    inn: string; // ИНН клиента
  }
  
  // Типизация для позиций счёта (items)
  export interface InvoiceItem {
    name: string; // Название услуги/товара
    unit: string; // Единица измерения
    tax: string; // Налог
    price: number; // Цена за единицу
    quantity: number; // Количество
    total: number; // Общая стоимость
  }
  
  // Типизация для общего объекта счёта
  export interface InvoiceData {
    supplier: Supplier; // Данные поставщика
    customer: Customer; // Данные клиента
    items: InvoiceItem[]; // Список позиций
    sum: number; // Общая сумма
  }
// Типизация ответа API
export interface InvoiceApiResponse {
    url: string; // URL на сгенерированный PDF
}
