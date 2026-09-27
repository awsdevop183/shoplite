-- ShopLite database schema + sample data
-- Run on the DATABASE EC2 instance:  sudo mysql < schema.sql

CREATE DATABASE IF NOT EXISTS shoplite;
USE shoplite;

CREATE TABLE IF NOT EXISTS products (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100)  NOT NULL,
  price      DECIMAL(10,2) NOT NULL,
  stock      INT           NOT NULL DEFAULT 0,
  created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (name, price, stock) VALUES
  ('Wireless Mouse',      19.99, 50),
  ('Mechanical Keyboard', 79.00, 20),
  ('USB-C Cable',          9.49, 200),
  ('27" Monitor',        229.00, 8);
