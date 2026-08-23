-- CreateTable
CREATE TABLE "about_section" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "chefPhoto" TEXT,
    "chefHeading" TEXT,
    "chefName" TEXT,
    "chefBio" TEXT,
    "image1" TEXT,
    "image1Alt" TEXT,
    "image2" TEXT,
    "image2Alt" TEXT,
    "image3" TEXT,
    "image3Alt" TEXT,
    "status" "Status" NOT NULL DEFAULT 'LIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "about_section_pkey" PRIMARY KEY ("id")
);

