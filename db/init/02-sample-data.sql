-- Sample data for intelligent chat testing
USE chatdb;

-- Ensure tables exist
CREATE TABLE IF NOT EXISTS chat_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_name VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    user_message TEXT NOT NULL,
    ai_response TEXT,
    tables_accessed TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample table for enriched queries
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    price DECIMAL(10, 2),
    stock_quantity INT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Populating sample data
INSERT IGNORE INTO chat_settings (setting_name, setting_value) VALUES 
('ollama_url', 'http://ollama:11434'),
('ollama_model', 'deepseek-coder-v2:16b-lite-instruct-q4_K_M'),
('enable_schema_info', 'true'),
('enabled_tables', 'chat_settings,chat_history,products'),
('max_results', '50');

INSERT IGNORE INTO products (name, category, price, stock_quantity, description) VALUES
('Quantum Laptop X1', 'Electronics', 1299.99, 50, 'High-performance laptop with quantum processing units.'),
('Neural Headphones Pro', 'Audio', 299.50, 150, 'Noise-canceling headphones with direct neural interface.'),
('Holo-Watch series 7', 'Wearables', 450.00, 75, 'Smartwatch with holographic display and health monitoring.'),
('Synapse Tablet 10', 'Electronics', 599.00, 100, 'Ultra-thin tablet for creative professionals.'),
('Acoustic Pulse Speakers', 'Audio', 159.99, 200, 'Wireless speakers with deep bass and crystal clear sound.');

INSERT IGNORE INTO chat_history (session_id, user_message, ai_response, tables_accessed) VALUES
('initial_session', 'Hello, what can you do?', 'I am a smart assistant that can help you query and analyze your database data.', ''),
('initial_session', 'What products do we have?', 'We have several products including the Quantum Laptop X1, Neural Headphones Pro, and Holo-Watch series 7.', 'products');
