import { Hero } from '@/components/marketing/Hero';
import { Statement } from '@/components/marketing/Statement';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';
import { Pipeline } from '@/components/marketing/Pipeline';
import { ReviewSection } from '@/components/marketing/ReviewSection';
import { UseCases } from '@/components/marketing/UseCases';
import { ProofDrift } from '@/components/marketing/ProofDrift';
import { TrustSection } from '@/components/marketing/TrustSection';
import { PricingTeaser } from '@/components/marketing/PricingTeaser';
import { Faq } from '@/components/marketing/Faq';
import { CtaBand } from '@/components/marketing/CtaBand';
import { listPublicPlans } from '@/lib/billing/plans';

export const revalidate = 300;

export default async function LandingPage() {
  const plans = await listPublicPlans();
  return (
    <>
      <Hero />
      <Statement />
      <FeatureGrid />
      <Pipeline />
      <ReviewSection />
      <UseCases />
      <ProofDrift />
      <TrustSection />
      <PricingTeaser plans={plans} />
      <Faq />
      <CtaBand />
    </>
  );
}
