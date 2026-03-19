-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "directionId" INTEGER NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MvpMonth" (
    "id" SERIAL NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MvpMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MvpItem" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "monthId" INTEGER NOT NULL,
    "endMonthId" INTEGER,
    "productId" INTEGER,

    CONSTRAINT "MvpItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add productId and mvpItemId to Task
ALTER TABLE "Task" ADD COLUMN "productId" INTEGER;
ALTER TABLE "Task" ADD COLUMN "mvpItemId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_directionId_key" ON "Product"("name", "directionId");

-- CreateIndex
CREATE UNIQUE INDEX "MvpMonth_yearMonth_key" ON "MvpMonth"("yearMonth");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "Direction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpItem" ADD CONSTRAINT "MvpItem_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "MvpMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpItem" ADD CONSTRAINT "MvpItem_endMonthId_fkey" FOREIGN KEY ("endMonthId") REFERENCES "MvpMonth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpItem" ADD CONSTRAINT "MvpItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_mvpItemId_fkey" FOREIGN KEY ("mvpItemId") REFERENCES "MvpItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
