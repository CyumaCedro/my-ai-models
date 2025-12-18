-- Initialize the chat database with sample tables and data
CREATE DATABASE IF NOT EXISTS chatdb;
USE chatdb;

-- Create sample tables for demonstration
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_name VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create table for chat history
CREATE TABLE IF NOT EXISTS chat_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    tables_accessed TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id),
    INDEX idx_timestamp (timestamp)
);

-- Insert sample data
INSERT INTO customers (name, email, phone, address) VALUES
('John Doe', 'john.doe@example.com', '+1-555-0101', '123 Main St, New York, NY 10001'),
('Jane Smith', 'jane.smith@example.com', '+1-555-0102', '456 Oak Ave, Los Angeles, CA 90001'),
('Bob Johnson', 'bob.johnson@example.com', '+1-555-0103', '789 Pine Rd, Chicago, IL 60601');

INSERT INTO products (name, description, price, stock_quantity, category) VALUES
('Laptop Pro', 'High-performance laptop with 16GB RAM and 512GB SSD', 1299.99, 50, 'Electronics'),
('Wireless Mouse', 'Ergonomic wireless mouse with long battery life', 29.99, 200, 'Electronics'),
('Office Chair', 'Comfortable office chair with lumbar support', 199.99, 30, 'Furniture'),
('Desk Lamp', 'LED desk lamp with adjustable brightness', 39.99, 100, 'Lighting');

INSERT INTO orders (customer_id, product_name, quantity, price, status) VALUES
(1, 'Laptop Pro', 1, 1299.99, 'delivered'),
(2, 'Wireless Mouse', 2, 29.99, 'shipped'),
(1, 'Office Chair', 1, 199.99, 'processing'),
(3, 'Desk Lamp', 3, 39.99, 'pending');

-- Insert default chat settings
INSERT INTO chat_settings (setting_name, setting_value, description) VALUES
('enabled_tables', 'customers,orders,products', 'Comma-separated list of tables the AI can access'),
('max_results', '100', 'Maximum number of results to return from database queries'),
('response_style', 'professional', 'Style of AI responses: professional, casual, technical'),
('enable_schema_info', 'true', 'Whether to include table schema information in AI context'),
('cache_duration', '300', 'Duration in seconds to cache database query results');
