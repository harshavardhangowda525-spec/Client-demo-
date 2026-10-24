import { formatMoney } from '../lib/format';
import type { PriceLine } from '../lib/types';

export function PriceBreakdown({
  lines,
  totalMinor,
  depositMinor,
  currency = 'INR',
  amountPaidMinor,
  isSample,
  caption = 'Price breakdown',
}: {
  lines: PriceLine[];
  totalMinor: number;
  depositMinor?: number;
  currency?: string;
  amountPaidMinor?: number;
  isSample?: boolean;
  caption?: string;
}) {
  return (
    <div>
      <table className="breakdown">
        <caption className="visually-hidden">{caption}</caption>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className={l.kind === 'TAX' || l.kind === 'FEE' ? 'sub' : undefined}>
              <td>
                {l.description}
                {l.kind === 'ADDON' && <span className="muted small"> · add-on</span>}
              </td>
              <td className="price">{formatMoney(l.totalMinor, currency)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            <td className="price">{formatMoney(totalMinor, currency)}</td>
          </tr>
          {depositMinor !== undefined && depositMinor > 0 && depositMinor < totalMinor && (
            <tr className="sub">
              <td>Deposit due to confirm</td>
              <td className="price">{formatMoney(depositMinor, currency)}</td>
            </tr>
          )}
          {amountPaidMinor !== undefined && amountPaidMinor > 0 && (
            <tr className="sub">
              <td>Paid so far</td>
              <td className="price">{formatMoney(amountPaidMinor, currency)}</td>
            </tr>
          )}
        </tbody>
      </table>
      {isSample && <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>Sample prices and tax rate for demonstration. Calculated on the server.</p>}
    </div>
  );
}
