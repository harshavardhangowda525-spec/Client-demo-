-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "priceMinor" INTEGER NOT NULL,
    "periodDays" INTEGER NOT NULL DEFAULT 30,
    "bookingDiscountBps" INTEGER NOT NULL DEFAULT 5000,
    "perks" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "isSimulated" BOOLEAN NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPlan_key_key" ON "MembershipPlan"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_providerOrderId_key" ON "Membership"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_providerPaymentId_key" ON "Membership"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written integrity rules
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_price_check" CHECK ("priceMinor" >= 0);
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_period_check" CHECK ("periodDays" BETWEEN 1 AND 3660);
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_discount_check" CHECK ("bookingDiscountBps" BETWEEN 0 AND 10000);
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_amount_check" CHECK ("amountMinor" >= 0);
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_active_dates_check" CHECK ("status" <> 'ACTIVE' OR ("startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" > "startsAt"));
-- A user can hold only one active membership at a time.
CREATE UNIQUE INDEX "Membership_one_active_per_user" ON "Membership" ("userId") WHERE "status" = 'ACTIVE';
