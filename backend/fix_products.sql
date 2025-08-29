-- Fix all products to be available
UPDATE products SET is_available = 1 WHERE id IN (1, 2, 3);

-- Verify the fix
SELECT id, name, is_available, price FROM products;
