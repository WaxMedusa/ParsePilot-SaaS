import { prisma } from '../prisma';
import { Decimal } from '@prisma/client/runtime/library';

const ECB_API_BASE = 'https://api.frankfurter.app';

export type FxRate = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  date: string;
};

export async function getLatestFxRate(baseCurrency: string, quoteCurrency: string): Promise<FxRate | null> {
  if (baseCurrency === quoteCurrency) {
    return { baseCurrency, quoteCurrency, rate: 1, date: new Date().toISOString().split('T')[0] };
  }

  const cached = await prisma.fxRate.findFirst({
    where: {
      baseCurrency,
      quoteCurrency,
      date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { date: 'desc' },
  });

  if (cached) {
    return {
      baseCurrency: cached.baseCurrency,
      quoteCurrency: cached.quoteCurrency,
      rate: Number(cached.rate),
      date: cached.date.toISOString().split('T')[0],
    };
  }

  // Fetch from ECB API
  const response = await fetch(`${ECB_API_BASE}/latest?from=${baseCurrency}&to=${quoteCurrency}`);
  if (!response.ok) return null;

  const data = await response.json();
  const rate = data.rates?.[quoteCurrency];

  if (!rate) return null;

  const today = new Date().toISOString().split('T')[0];
  await prisma.fxRate.upsert({
    where: {
      workspaceId_baseCurrency_quoteCurrency_date: {
        workspaceId: 'default', // Workspace-specific rates would need workspaceId
        baseCurrency,
        quoteCurrency,
        date: new Date(today),
      },
    },
    update: { rate },
    create: {
      id: crypto.randomUUID(),
      workspaceId: 'default',
      baseCurrency,
      quoteCurrency,
      rate,
      date: new Date(today),
      source: 'ecb',
    },
  });

  return { baseCurrency, quoteCurrency, rate, date: today };
}

export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate?: number
): Promise<{ convertedAmount: number; rate: number } | null> {
  if (fromCurrency === toCurrency) return { convertedAmount: amount, rate: 1 };

  const fxRate = rate ?? (await getLatestFxRate(fromCurrency, toCurrency))?.rate;
  if (!fxRate) return null;

  return {
    convertedAmount: Math.round(amount * fxRate * 100) / 100,
    rate: fxRate,
  };
}

export async function getHistoricalRate(baseCurrency: string, quoteCurrency: string, date: string): Promise<number | null> {
  if (baseCurrency === quoteCurrency) return 1;

  const cached = await prisma.fxRate.findFirst({
    where: {
      baseCurrency,
      quoteCurrency,
      date: new Date(date),
    },
  });

  if (cached) return Number(cached.rate);

  const response = await fetch(`${ECB_API_BASE}/${date}?from=${baseCurrency}&to=${quoteCurrency}`);
  if (!response.ok) return null;

  const data = await response.json();
  return data.rates?.[quoteCurrency] ?? null;
}