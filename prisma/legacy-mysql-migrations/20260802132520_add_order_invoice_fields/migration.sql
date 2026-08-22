-- AlterTable
ALTER TABLE `orders` ADD COLUMN `address` TEXT NULL,
    ADD COLUMN `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `flavour` VARCHAR(191) NULL,
    ADD COLUMN `invoiceGeneratedAt` DATETIME(3) NULL,
    ADD COLUMN `invoicePath` VARCHAR(191) NULL,
    ADD COLUMN `weight` VARCHAR(191) NULL;
