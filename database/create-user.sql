-- Creates the application user the BACKEND server logs in with.
-- '%' lets it connect from another machine (the backend EC2).
-- The security group is what restricts WHO can actually reach port 3306.
-- Change the password before running!

CREATE USER IF NOT EXISTS 'shopuser'@'%' IDENTIFIED BY 'ChangeMe123!';
GRANT ALL PRIVILEGES ON shoplite.* TO 'shopuser'@'%';
FLUSH PRIVILEGES;
