CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "public"."Visibility" AS ENUM ('DRAFT', 'PUBLIC');
CREATE TYPE "public"."AssetType" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO');
CREATE TYPE "public"."LearningItemType" AS ENUM ('WORD', 'SOUND');
CREATE TYPE "public"."QuizItemType" AS ENUM ('SCQ', 'MCQ', 'SOUND');
CREATE TYPE "public"."ContentType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO');

CREATE TABLE "public"."Asset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."AssetType" NOT NULL,
    "url" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "metadata" JSONB,
    "visibility" "public"."Visibility" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Section" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sequence" DOUBLE PRECISION NOT NULL,
    "imageAssetId" TEXT,
    "visibility" "public"."Visibility" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Subsection" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sequence" DOUBLE PRECISION NOT NULL,
    "imageAssetId" TEXT,
    "visibility" "public"."Visibility" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subsection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."LearningItem" (
    "id" TEXT NOT NULL,
    "subsectionId" TEXT NOT NULL,
    "type" "public"."LearningItemType" NOT NULL,
    "sequence" DOUBLE PRECISION NOT NULL,
    "word" TEXT,
    "meaning" TEXT,
    "sound" TEXT,
    "description" TEXT,
    "imageAssetId" TEXT,
    "audioAssetId" TEXT,
    "visibility" "public"."Visibility" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LearningItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Quiz" (
    "id" TEXT NOT NULL,
    "subsectionId" TEXT NOT NULL,
    "passingPercentage" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "visibility" "public"."Visibility" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."QuizItem" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "type" "public"."QuizItemType" NOT NULL,
    "sequence" DOUBLE PRECISION NOT NULL,
    "questionType" "public"."ContentType" NOT NULL,
    "questionText" TEXT,
    "questionAssetId" TEXT,
    "visibility" "public"."Visibility" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuizItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."QuizOption" (
    "id" TEXT NOT NULL,
    "quizItemId" TEXT NOT NULL,
    "sequence" DOUBLE PRECISION NOT NULL,
    "type" "public"."ContentType" NOT NULL,
    "text" TEXT,
    "assetId" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "QuizOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Section_visibility_sequence_idx" ON "public"."Section"("visibility", "sequence");
CREATE UNIQUE INDEX "Section_sequence_key" ON "public"."Section"("sequence");
CREATE INDEX "Subsection_visibility_sequence_idx" ON "public"."Subsection"("visibility", "sequence");
CREATE UNIQUE INDEX "Subsection_sectionId_sequence_key" ON "public"."Subsection"("sectionId", "sequence");
CREATE INDEX "LearningItem_subsectionId_visibility_sequence_idx" ON "public"."LearningItem"("subsectionId", "visibility", "sequence");
CREATE UNIQUE INDEX "LearningItem_subsectionId_sequence_key" ON "public"."LearningItem"("subsectionId", "sequence");
CREATE UNIQUE INDEX "Quiz_subsectionId_key" ON "public"."Quiz"("subsectionId");
CREATE INDEX "QuizItem_quizId_visibility_sequence_idx" ON "public"."QuizItem"("quizId", "visibility", "sequence");
CREATE UNIQUE INDEX "QuizItem_quizId_sequence_key" ON "public"."QuizItem"("quizId", "sequence");
CREATE INDEX "QuizOption_quizItemId_sequence_idx" ON "public"."QuizOption"("quizItemId", "sequence");
CREATE UNIQUE INDEX "QuizOption_quizItemId_sequence_key" ON "public"."QuizOption"("quizItemId", "sequence");

ALTER TABLE "public"."Section" ADD CONSTRAINT "Section_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "public"."Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Subsection" ADD CONSTRAINT "Subsection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Subsection" ADD CONSTRAINT "Subsection_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "public"."Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."LearningItem" ADD CONSTRAINT "LearningItem_subsectionId_fkey" FOREIGN KEY ("subsectionId") REFERENCES "public"."Subsection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."LearningItem" ADD CONSTRAINT "LearningItem_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "public"."Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."LearningItem" ADD CONSTRAINT "LearningItem_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "public"."Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Quiz" ADD CONSTRAINT "Quiz_subsectionId_fkey" FOREIGN KEY ("subsectionId") REFERENCES "public"."Subsection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."QuizItem" ADD CONSTRAINT "QuizItem_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "public"."Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."QuizItem" ADD CONSTRAINT "QuizItem_questionAssetId_fkey" FOREIGN KEY ("questionAssetId") REFERENCES "public"."Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."QuizOption" ADD CONSTRAINT "QuizOption_quizItemId_fkey" FOREIGN KEY ("quizItemId") REFERENCES "public"."QuizItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."QuizOption" ADD CONSTRAINT "QuizOption_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;