import { TableData } from '../types/types.ts';
import { tableNumber } from './seating.ts';

/** "Table 3", "Head table" or the custom name of the table. */
export function tableLabel(t: (key: string) => string, tables: TableData[], table: TableData) {
    return table.tableName || (table.isHeadTable ? t('head_table_default') : `${t('table')} ${tableNumber(tables, table)}`);
}

/** Short mark for plans: the table number (or a crown for the head table). */
export function tableShortLabel(tables: TableData[], table: TableData) {
    return table.isHeadTable ? '♛' : String(tableNumber(tables, table));
}

export function formatDate(date: string, language: string) {
    if (!date) return '';
    const parsed = new Date(`${date}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    const locale = language === 'am' ? 'hy-AM' : language === 'ru' ? 'ru-RU' : 'en-GB';
    return parsed.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
