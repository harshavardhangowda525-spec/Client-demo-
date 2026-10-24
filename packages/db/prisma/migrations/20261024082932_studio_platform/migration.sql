-- CreateEnum
CREATE TYPE "RescheduleStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EventEnquiry" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "deliverables" INTEGER,
ADD COLUMN     "expectedDuration" TEXT;

-- AlterTable
ALTER TABLE "PortfolioProject" ADD COLUMN     "clientCredit" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "depositBpsOverride" INTEGER,
ADD COLUMN     "galleryImageKeys" TEXT[],
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preparation" TEXT;

-- CreateTable
CREATE TABLE "DiscoveryCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceDiscoveryCategory" (
    "serviceId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "ServiceDiscoveryCategory_pkey" PRIMARY KEY ("serviceId","categoryId")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "imageKey" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceEquipment" (
    "serviceId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,

    CONSTRAINT "ServiceEquipment_pkey" PRIMARY KEY ("serviceId","equipmentId")
);

-- CreateTable
CREATE TABLE "HomeBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageKey" TEXT NOT NULL,
    "imageAlt" TEXT NOT NULL,
    "ctaLabel" TEXT NOT NULL,
    "ctaHref" TEXT NOT NULL,
    "offerText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorDetail" TEXT,
    "serviceId" TEXT,
    "isAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPage" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "SavedService" (
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedService_pkey" PRIMARY KEY ("customerId","serviceId")
);

-- CreateTable
CREATE TABLE "RescheduleRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "requestedStart" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "RescheduleStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "RescheduleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryAttachment" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryCategory_slug_key" ON "DiscoveryCategory"("slug");

-- CreateIndex
CREATE INDEX "ServiceDiscoveryCategory_categoryId_idx" ON "ServiceDiscoveryCategory"("categoryId");

-- CreateIndex
CREATE INDEX "RescheduleRequest_status_createdAt_idx" ON "RescheduleRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RescheduleRequest_bookingId_idx" ON "RescheduleRequest"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "EnquiryAttachment_storedName_key" ON "EnquiryAttachment"("storedName");

-- CreateIndex
CREATE INDEX "EnquiryAttachment_enquiryId_idx" ON "EnquiryAttachment"("enquiryId");

-- AddForeignKey
ALTER TABLE "ServiceDiscoveryCategory" ADD CONSTRAINT "ServiceDiscoveryCategory_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceDiscoveryCategory" ADD CONSTRAINT "ServiceDiscoveryCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DiscoveryCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEquipment" ADD CONSTRAINT "ServiceEquipment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEquipment" ADD CONSTRAINT "ServiceEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedService" ADD CONSTRAINT "SavedService_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedService" ADD CONSTRAINT "SavedService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryAttachment" ADD CONSTRAINT "EnquiryAttachment_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "EventEnquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written integrity rules
ALTER TABLE "Service" ADD CONSTRAINT "service_deposit_override" CHECK ("depositBpsOverride" IS NULL OR ("depositBpsOverride" >= 0 AND "depositBpsOverride" <= 10000));
ALTER TABLE "EnquiryAttachment" ADD CONSTRAINT "attachment_size" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 10485760);
-- Only one pending reschedule request per booking.
CREATE UNIQUE INDEX "reschedule_one_pending_per_booking" ON "RescheduleRequest" ("bookingId") WHERE "status" = 'PENDING';
