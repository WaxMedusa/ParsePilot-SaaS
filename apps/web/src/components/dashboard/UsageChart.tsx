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
            <CartesianGrid vertical={false} stroke="#d8d4c9" strokeDasharray="2 4" />
            <XAxis dataKey="label" tick={{ fontSize: 8.5, fill: '#999a90' }} tickLine={false} axisLine={{ stroke: '#d8d4c9' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 8.5, fill: '#999a90' }} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
            <Tooltip
              cursor={{ fill: 'rgba(98, 107, 86, 0.08)' }}
              contentStyle={{
                background: '#f3f1eb',
                border: '1px solid #bfbbaf',
                borderRadius: 0,
                fontSize: 10,
                color: '#171816',
                boxShadow: 'none',
              }}
              labelStyle={{ fontSize: 8.5, color: '#74766e', marginBottom: 2 }}
              formatter={(value: number) => [`${value} pages`, 'Processed']}
            />
            <ReferenceLine y={limit} stroke="#bfbbaf" strokeDasharray="3 3" />
            <Bar dataKey="pages" fill="#626b56" radius={0} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
