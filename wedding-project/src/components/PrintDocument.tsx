import { useTranslation } from 'react-i18next';
import { HallData, MealKind, MEALS, Venue } from '../types/types.ts';
import { byName, isSeated, seatIndex, seatKey } from '../utils/guests.ts';
import { headRoleKey } from '../utils/chairs.ts';
import { formatDate } from '../utils/labels.ts';
import { tableNumber } from '../utils/seating.ts';
import HallPlanSvg from './HallPlanSvg';

export type PrintSection = 'plan' | 'tables' | 'alphabet' | 'cards' | 'kitchen' | 'qr';
export const PRINT_SECTIONS: PrintSection[] = ['plan', 'tables', 'alphabet', 'cards', 'kitchen', 'qr'];

interface PrintDocumentProps {
    sections: PrintSection[];
    hall: HallData;
    title: string;
    date: string;
    venue: Venue | null;
    qrDataUrl?: string;
    tableLabelFor: (tableId: number) => string;
}

function PageHeader({ venue, title, date, heading }: { venue: Venue | null; title: string; date: string; heading: string }) {
    const { i18n } = useTranslation();
    return (
        <header className="print-header">
            <div className="print-brand">
                {venue?.logo && <img src={venue.logo} alt="" />}
                {venue?.name && <span>{venue.name}</span>}
            </div>
            <div className="print-title">
                <h1>{heading}</h1>
                <p>
                    {title}
                    {date ? ` · ${formatDate(date, i18n.language)}` : ''}
                </p>
            </div>
        </header>
    );
}

/** Everything a venue prints for the wedding day. Hidden on screen, shown only by window.print(). */
function PrintDocument({ sections, hall, title, date, venue, qrDataUrl, tableLabelFor }: PrintDocumentProps) {
    const { t } = useTranslation();
    const seats = seatIndex(hall.guests);
    const header = (heading: string) => <PageHeader venue={venue} title={title} date={date} heading={heading} />;
    const brandColor = venue?.brandColor || '#4a1f2b';

    const mealCounts = (tableId: number | null) => {
        const counts = Object.fromEntries(MEALS.map(meal => [meal, 0])) as Record<MealKind, number>;
        hall.guests
            .filter(guest => (tableId === null ? isSeated(guest) : guest.tableId === tableId))
            .forEach(guest => counts[guest.meal || 'standard']++);
        return counts;
    };

    return (
        <div className="print-document" style={{ '--brand': brandColor } as React.CSSProperties}>
            {sections.includes('plan') && (
                <section className="print-page landscape">
                    {header(t('print_plan'))}
                    <HallPlanSvg hall={hall} className="print-plan" />
                    {hall.groups.length > 0 && (
                        <div className="print-legend">
                            {hall.groups.map(group => (
                                <span key={group.id}>
                                    <i style={{ background: group.color }} /> {group.name}
                                </span>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {sections.includes('tables') && (
                <section className="print-page">
                    {header(t('print_tables'))}
                    <div className="print-table-grid">
                        {hall.tables.map(table => (
                            <div key={table.id} className="print-table-card">
                                <h3>
                                    {tableLabelFor(table.id)}
                                    <small>
                                        {Array.from({ length: table.capacity }, (_, i) => seats.get(seatKey(table.id, i))).filter(Boolean).length}/
                                        {table.capacity}
                                    </small>
                                </h3>
                                <ol>
                                    {Array.from({ length: table.capacity }, (_, i) => {
                                        const guest = seats.get(seatKey(table.id, i));
                                        const role = headRoleKey(table, i);
                                        return (
                                            <li key={i} className={guest ? '' : 'empty'}>
                                                <span>
                                                    {role && <b>{t(role)}: </b>}
                                                    {guest?.name || '—'}
                                                </span>
                                                {guest && (guest.meal && guest.meal !== 'standard' || guest.note) && (
                                                    <em>
                                                        {[guest.meal && guest.meal !== 'standard' ? t(`meal_${guest.meal}`) : '', guest.note]
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                    </em>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ol>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {sections.includes('alphabet') && (
                <section className="print-page">
                    {header(t('print_alphabet'))}
                    <div className="print-alphabet">
                        {[...hall.guests].filter(isSeated).sort(byName).map(guest => (
                            <div key={guest.id} className="print-alpha-row">
                                <span>{guest.name}</span>
                                <i />
                                <b>{tableLabelFor(guest.tableId!)}</b>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {sections.includes('cards') && (
                <section className="print-cards">
                    {hall.tables.map(table => (
                        <div key={table.id} className="print-card">
                            <div className="print-card-inner">
                                {venue?.logo && <img src={venue.logo} alt="" />}
                                <div className="print-card-number">{table.isHeadTable ? '♛' : tableNumber(hall.tables, table)}</div>
                                <div className="print-card-name">{tableLabelFor(table.id)}</div>
                                <div className="print-card-event">{title}</div>
                            </div>
                        </div>
                    ))}
                </section>
            )}

            {sections.includes('kitchen') && (
                <section className="print-page">
                    {header(t('print_kitchen'))}
                    <table className="print-kitchen">
                        <thead>
                            <tr>
                                <th>{t('table')}</th>
                                <th>{t('stats_guests')}</th>
                                {MEALS.map(meal => (
                                    <th key={meal}>{t(`meal_${meal}`)}</th>
                                ))}
                                <th>{t('note')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hall.tables.map(table => {
                                const counts = mealCounts(table.id);
                                const guests = hall.guests.filter(guest => guest.tableId === table.id);
                                return (
                                    <tr key={table.id}>
                                        <td>{tableLabelFor(table.id)}</td>
                                        <td>{guests.length}</td>
                                        {MEALS.map(meal => (
                                            <td key={meal} className={counts[meal] && meal !== 'standard' ? 'hot' : ''}>{counts[meal] || ''}</td>
                                        ))}
                                        <td className="notes">
                                            {guests.filter(guest => guest.note).map(guest => `${guest.name}: ${guest.note}`).join('; ')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td>{t('total')}</td>
                                <td>{hall.guests.filter(isSeated).length}</td>
                                {MEALS.map(meal => (
                                    <td key={meal}>{mealCounts(null)[meal]}</td>
                                ))}
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                    {hall.guests.some(guest => !isSeated(guest)) && (
                        <p className="print-warning">{t('print_unseated_warning', { count: hall.guests.filter(guest => !isSeated(guest)).length })}</p>
                    )}
                    {hall.groups.length > 0 && <p className="print-muted">{hall.groups.map(g => `${g.name}: ${hall.guests.filter(x => x.groupId === g.id).length}`).join(' · ')}</p>}
                </section>
            )}

            {sections.includes('qr') && qrDataUrl && (
                <section className="print-page print-qr">
                    {venue?.logo && <img className="print-qr-logo" src={venue.logo} alt="" />}
                    <h1>{t('qr_poster_title')}</h1>
                    <p>{t('qr_poster_text')}</p>
                    <img className="print-qr-code" src={qrDataUrl} alt="QR" />
                    <h2>{title}</h2>
                    {venue?.name && <p className="print-muted">{venue.name}</p>}
                </section>
            )}
        </div>
    );
}

export default PrintDocument;
