ALTER TABLE "public"."QuizItem" ADD COLUMN "subsectionId" TEXT;

UPDATE "public"."QuizItem" AS item
SET "subsectionId" = quiz."subsectionId"
FROM "public"."Quiz" AS quiz
WHERE item."quizId" = quiz."id";

UPDATE "public"."QuizItem" AS item
SET "visibility" = 'DRAFT'
FROM "public"."Quiz" AS quiz
WHERE item."quizId" = quiz."id"
  AND quiz."visibility" = 'DRAFT'
  AND item."visibility" = 'PUBLIC';

ALTER TABLE "public"."QuizItem" ALTER COLUMN "subsectionId" SET NOT NULL;
ALTER TABLE "public"."QuizItem" DROP CONSTRAINT "QuizItem_quizId_fkey";
DROP INDEX "public"."QuizItem_quizId_visibility_sequence_idx";
DROP INDEX "public"."QuizItem_quizId_sequence_key";
ALTER TABLE "public"."QuizItem" DROP COLUMN "quizId";
DROP INDEX "public"."Quiz_subsectionId_key";
DROP TABLE "public"."Quiz";

CREATE INDEX "QuizItem_subsectionId_visibility_sequence_idx"
ON "public"."QuizItem"("subsectionId", "visibility", "sequence");
CREATE UNIQUE INDEX "QuizItem_subsectionId_sequence_key"
ON "public"."QuizItem"("subsectionId", "sequence");
ALTER TABLE "public"."QuizItem" ADD CONSTRAINT "QuizItem_subsectionId_fkey"
FOREIGN KEY ("subsectionId") REFERENCES "public"."Subsection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
