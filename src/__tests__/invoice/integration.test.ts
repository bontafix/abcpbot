import fs from 'fs';
import path from 'path';
import os from 'os';
import { generatePdf } from '../../invoice/service';

describe('Invoice integration (real PDF generation)', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'abcpbot-int-'));
  const imgDir = path.join(tmpRoot, 'img');
  const outDir = path.join(tmpRoot, 'out');
  const templateFixture = path.resolve(__dirname, '../fixtures/template.html');
  const stampB64 = fs.readFileSync(path.resolve(__dirname, '../fixtures/stamp.png.b64'), 'utf8').trim();
  const signB64 = fs.readFileSync(path.resolve(__dirname, '../fixtures/sign.png.b64'), 'utf8').trim();
  const logoB64 = fs.readFileSync(path.resolve(__dirname, '../fixtures/logouna.png.b64'), 'utf8').trim();

  beforeAll(() => {
    fs.mkdirSync(imgDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
    // Раскладываем PNG из фикстур
    fs.writeFileSync(path.join(imgDir, 'stamp.png'), Buffer.from(stampB64, 'base64'));
    fs.writeFileSync(path.join(imgDir, 'sign.png'), Buffer.from(signB64, 'base64'));
    fs.writeFileSync(path.join(imgDir, 'logouna.png'), Buffer.from(logoB64, 'base64'));

    // Переменные окружения для генерации
    process.env.PATH_LOCAL = tmpRoot;
    process.env.FILE_TEMPLATE = templateFixture;
    process.env.URL_DOWNLOAD = 'http://localhost/files/';
    process.env.PATH_OUTPUT_STATIC = outDir + path.sep;
  });

  afterAll(() => {
    try {
      // Чистим временную директорию
      const entries = fs.readdirSync(tmpRoot);
      for (const e of entries) {
        const p = path.join(tmpRoot, e);
        if (fs.statSync(p).isDirectory()) {
          const sub = fs.readdirSync(p);
          for (const s of sub) fs.unlinkSync(path.join(p, s));
          fs.rmdirSync(p);
        } else {
          fs.unlinkSync(p);
        }
      }
      fs.rmdirSync(tmpRoot);
    } catch {}
  });

  it('должен сгенерировать PDF и вернуть корректные данные', async () => {
    const data = {
      supplier: {
        title: 'ООО "Тестовая Компания"',
        rs: '40702810123456789012',
        bik: '044525745',
        ks: '30101810145250000745',
        inn: '7701234567'
      },
      customer: { name: 'ИП Иванов И.И.' },
      sum: 1500.5,
      comment: 'Оплата за услуги',
      number: 'INV-INT-001',
      date: '15.12.2024'
    } as any;

    const result = await generatePdf(data);
    expect(result).toBeDefined();
    if (!result) return;

    // Проверяем файл
    const pdfPath = path.join(outDir, result.file);
    expect(fs.existsSync(pdfPath)).toBe(true);
    const stat = fs.statSync(pdfPath);
    expect(stat.size).toBeGreaterThan(0);

    // Проверяем URL
    expect(result.url).toContain(result.file);
  }, 60000);
});

describe('Invoice integration', () => {
  it('заглушка интеграционного теста', async () => {
    // Здесь позже можно проверить полный цикл генерации PDF с моками
    expect(1 + 1).toBe(2);
  });
});


