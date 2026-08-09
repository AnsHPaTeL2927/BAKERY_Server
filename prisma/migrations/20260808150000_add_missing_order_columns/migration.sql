-- Add missing columns to orders table and update enums

-- Step 1: Add discount column (was missing from original CREATE TABLE)
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Step 2: Add weight column
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `weight` VARCHAR(191) NULL;

-- Step 3: Add flavour column
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `flavour` VARCHAR(191) NULL;

-- Step 4: Add address column
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `address` TEXT NULL;

-- Step 5: Add paymentMethod column with ENUM
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `paymentMethod` ENUM('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER') NOT NULL DEFAULT 'CASH';

-- Step 6: Expand status ENUM to include OUT_FOR_DELIVERY and COMPLETED
ALTER TABLE `orders` MODIFY `status` ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- Step 7: Expand paymentStatus ENUM to include UNPAID, PARTIALLY_PAID (alongside existing PENDING, PARTIAL, PAID, REFUNDED)
ALTER TABLE `orders` MODIFY `paymentStatus` ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'PENDING', 'PARTIAL') NOT NULL DEFAULT 'UNPAID';
