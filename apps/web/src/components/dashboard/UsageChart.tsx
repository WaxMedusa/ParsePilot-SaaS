'use client';

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import styles from './UsageChart.module.css';

export type UsagePoint = { date: string; label: string; pages: number };

export function UsageChart({ data, limit }: { data: UsagePoint[]; limit: number }) {
  const total = data.reduce((sum, point) => sum + point.pages, 0);

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <p className={styles.title}>Pages processed</p>
          <p className={styles.meta}>Last 14 days · {total} page{total === 1 ? '' : 's'} in this window</p>
        </div>
        <span className={styles.limit}>Monthly limit {limit.toLocaleString('en-US')}</span>
      </div>
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -18 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#E9EBF1" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: '#8B92A2' }} tickLine={false} axisLine={{ stroke: '#E6E9EF' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9.5, fill: '#8B92A2' }} tickLine={false} axisLine={false} allowDecimals={false} width={38} />
            <Tooltip
              cursor={{ fill: 'rgba(99, 91, 255, 0.06)' }}
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #E6E9EF',
                borderRadius: 8,
                fontSize: 11,
                color: '#171A23',
                boxShadow: '0 8px 24px rgba(16,19,34,0.08)',
              }}
              labelStyle={{ fontSize: 10, color: '#6D7484', marginBottom: 2 }}
              formatter={(value: number) => [`${value} pages`, 'Processed']}
            />
            <ReferenceLine y={limit} stroke="#C9CDD6" strokeDasharray="4 4" />
            <Bar dataKey="pages" fill="#635BFF" radius={[2, 2, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
