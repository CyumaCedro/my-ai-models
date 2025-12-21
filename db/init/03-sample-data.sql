-- Sample database initialization script for chat application
-- This creates basic tables for demonstration purposes

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    stock_quantity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Insert sample data if tables are empty
INSERT IGNORE INTO customers (id, name, email, phone, address) VALUES
(1, 'John Doe', 'john@example.com', '555-0101', '123 Main St, Anytown, USA'),
(2, 'Jane Smith', 'jane@example.com', '555-0102', '456 Oak Ave, Somewhere, USA'),
(3, 'Bob Johnson', 'bob@example.com', '555-0103', '789 Pine Rd, Nowhere, USA');

INSERT IGNORE INTO products (id, name, description, price, category, stock_quantity) VALUES
(1, 'Laptop Computer', 'High-performance laptop with 16GB RAM and 512GB SSD', 999.99, 'Electronics', 50),
(2, 'Wireless Mouse', 'Ergonomic wireless mouse with precision tracking', 29.99, 'Electronics', 200),
(3, 'Office Chair', 'Comfortable office chair with lumbar support', 199.99, 'Furniture', 30),
(4, 'Coffee Maker', 'Programmable coffee maker with thermal carafe', 79.99, 'Appliances', 40),
(5, 'Desk Lamp', 'LED desk lamp with adjustable brightness', 34.99, 'Furniture', 75);

INSERT IGNORE INTO orders (id, customer_id, total_amount, status, order_date) VALUES
(1, 1, 1029.98, 'delivered', '2024-01-15 10:30:00'),
(2, 2, 234.98, 'shipped', '2024-01-20 14:15:00'),
(3, 3, 79.99, 'pending', '2024-01-25 09:45:00');

INSERT IGNORE INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES
(1, 1, 1, 999.99, 999.99),
(1, 2, 1, 29.99, 29.99),
(2, 3, 1, 199.99, 199.99),
(2, 4, 1, 79.99, 79.99),
(3, 5, 1, 34.99, 34.99);