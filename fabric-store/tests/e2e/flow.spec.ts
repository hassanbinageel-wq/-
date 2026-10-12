import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const shots = process.env.SHOTS_DIR;
const snap = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
};

test('دورة كاملة: دخول، عميل، صنف، فاتورة، دفعة، كشف حساب', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  for (const k of ['1', '2', '3', '4']) await page.locator('.keypad button', { hasText: k }).first().click();
  await page.locator('.keypad button', { hasText: '✓' }).click();
  await expect(page.locator('.topbar h1')).toHaveText('لوحة التحكم');
  await snap(page, '01-dashboard-empty');

  // صنف جديد
  await page.goto('/#/products');
  await page.getByRole('button', { name: 'صنف جديد' }).first().click();
  await page.getByLabel('اسم القماش / الموديل *').fill('قماش تويوبو');
  await page.getByLabel('نوع القماش (المنشأ)').selectOption('ياباني');
  await page.getByLabel('اللون / الدرجة').fill('أبيض ثلجي');
  await page.getByLabel(/عدد الياردات في الطاقة/).fill('30');
  await page.getByLabel('عدد الطاقات في الكرتون').fill('10');
  await page.getByLabel(/تكلفة الشراء/).fill('1000');
  await page.getByLabel(/سعر البيع بالجملة/).fill('1500');
  await page.getByLabel(/حد التنبيه/).fill('500');
  await page.getByLabel('الرصيد الافتتاحي (الكمية الحالية)').fill('5');
  await page.getByLabel('بوحدة').selectOption('كرتون');
  await snap(page, '02-product-form');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.locator('.list-item').first()).toContainText('1,500 ياردة');

  // فاتورة جديدة مع عميل جديد
  await page.goto('/#/invoice-new');
  await page.getByPlaceholder('ابحث بالاسم أو الهاتف…').click();
  await page.getByPlaceholder('ابحث بالاسم أو الهاتف…').fill('محلات الأمانة');
  await page.getByRole('button', { name: /عميل جديد/ }).click();
  await page.getByLabel('رقم الهاتف').fill('777123456');
  await page.getByLabel('المنطقة / المدينة').fill('صنعاء');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.locator('.seg button', { hasText: 'آجل' }).click();
  await page.getByPlaceholder('ابحث بالاسم أو الكود أو اللون…').click();
  await page.locator('.picker-list button', { hasText: 'قماش تويوبو' }).click();
  await page.getByLabel('وحدة البيع').selectOption('كرتون');
  await page.getByLabel(/^الكمية \(/).fill('2');
  await page.getByLabel('الخصم').first().fill('20000');
  await page.getByLabel('المبلغ المدفوع عند الإصدار').fill('180000');
  await expect(page.locator('.summary-box')).toContainText('880,000');
  await snap(page, '03-invoice-editor');
  await page.getByRole('button', { name: 'اعتماد الفاتورة' }).click();
  await expect(page.locator('.modal-head h3')).toContainText('فاتورة INV-00001');
  await page.waitForTimeout(600);
  await snap(page, '04-invoice-print');
  // توليد PDF فعليًا
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /حفظ PDF/ }).click();
  const file = await dl;
  const pdfHead = readFileSync(await file.path()).subarray(0, 5).toString();
  expect(pdfHead).toBe('%PDF-');
  if (shots) await file.saveAs(`${shots}/invoice.pdf`);
  await page.getByLabel('إغلاق').click();
  await expect(page.locator('.summary-box').first()).toContainText('700,000');
  await snap(page, '05-invoice-view');

  // دفعة
  await page.getByRole('button', { name: 'تسجيل دفعة' }).click();
  await page.getByLabel('قيمة الدفعة *').fill('200000');
  await page.getByLabel(/المبلغ لـ INV-00001/).fill('200000');
  await page.getByRole('button', { name: 'حفظ وإصدار السند' }).click();
  await expect(page.locator('.modal-head h3')).toContainText('سند قبض');
  await page.waitForTimeout(400);
  await snap(page, '06-receipt');
  await page.getByLabel('إغلاق').click();
  await expect(page.locator('.summary-box').first()).toContainText('500,000');

  // ملف العميل وكشف الحساب
  await page.locator('.list-item', { hasText: 'محلات الأمانة' }).first().click();
  await expect(page.locator('.kpi.accent .value')).toContainText('500,000');
  await snap(page, '07-customer');

  // المخزون نقص كرتونين
  await page.goto('/#/products');
  await expect(page.locator('.list-item').first()).toContainText('900 ياردة');

  // لوحة التحكم والوضع الداكن
  await page.goto('/#/dashboard');
  await expect(page.locator('.kpi.accent .value')).toContainText('880,000');
  await snap(page, '08-dashboard');
  await page.getByLabel('تبديل الوضع').click();
  await page.waitForTimeout(300);
  await snap(page, '09-dashboard-dark');

  // التقارير
  await page.goto('/#/reports');
  await expect(page.locator('table.t tfoot')).toContainText('880,000');
  await snap(page, '10-reports');

  // النسخ الاحتياطي
  await page.goto('/#/settings');
  const bk = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير نسخة احتياطية' }).click();
  const b = await bk;
  const path = await b.path();
  const json = JSON.parse(readFileSync(path, 'utf8'));
  expect(json.tables.invoices.length).toBe(1);
  await snap(page, '11-settings');

  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});
