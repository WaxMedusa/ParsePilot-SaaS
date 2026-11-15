import { Hero } from '@/components/marketing/Hero';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';
import { Pipeline } from '@/components/marketing/Pipeline';
import { ReviewSection } from '@/components/marketing/ReviewSection';
import { TrustSection } from '@/components/marketing/TrustSection';
import { PricingTeaser } from '@/components/marketing/PricingTeaser';
import { CtaBand } from '@/components/marketing/CtaBand';
import { listPublicPlans } from '@/lib/billing/plans';

export const revalidate = 300;

export default async function LandingPage() {
  const plans = await listPublicPlans();
  return (
    <>
      <Hero />
      <FeatureGrid />
      <Pipeline />
      <ReviewSection />
      <TrustSection />
      <PricingTeaser plans={plans} />
      <CtaBand />
    </>
  );
}
