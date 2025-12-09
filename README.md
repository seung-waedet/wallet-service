# Wallet Service

A secure and scalable wallet service built with NestJS, designed for managing digital wallets, transactions, and user authentication.

## Features

- **User Authentication**: Secure login and registration with JWT tokens
- **Google OAuth Integration**: Seamless third-party authentication
- **Payment Processing**: Integrated with Paystack for secure payments
- **Transaction Management**: Track deposits, withdrawals, and transfers
- **Database Integration**: PostgreSQL database with Aiven hosting
- **RESTful API**: Clean and intuitive API endpoints
- **Environment Configuration**: Secure environment variable management

## Tech Stack

- **Backend Framework**: [NestJS](https://nestjs.com/) (Node.js)
- **Database**: PostgreSQL 
- **Authentication**: JWT + Google OAuth
- **Payments**: Paystack API
- **API Documentation**: Swagger 

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- PostgreSQL 

## Installation

1. Clone the repository:
```bash
git clone https://github.com/seung-waedet/wallet-service.git
cd wallet-service
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Update the `.env` file with your actual configuration:
```env
DB_HOST=your_db_host
DB_PORT=your_db_port
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

# Google Auth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION=1d

# Paystack
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_BASE_URL=https://api.paystack.co
```

## Running the Application

### Development
```bash
# Run in development mode with auto-reload
npm run start:dev
```

### Production
```bash
# Build the application
npm run build

# Run in production mode
npm run start:prod
```

### Standalone
```bash
# Run without watching for changes
npm run start
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login with email and password
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `POST /auth/logout` - Logout user
- `POST /auth/refresh` - Refresh JWT token

### Wallet Management
- `GET /wallets/me` - Get authenticated user's wallet
- `POST /wallets` - Create a new wallet (if doesn't exist)
- `GET /wallets/:id` - Get specific wallet details
- `PUT /wallets/:id` - Update wallet information

### Transactions
- `GET /transactions` - Get user's transaction history
- `POST /transactions/deposit` - Deposit funds
- `POST /transactions/withdraw` - Withdraw funds
- `POST /transactions/transfer` - Transfer funds to another user

### User Profile
- `GET /users/profile` - Get authenticated user profile
- `PUT /users/profile` - Update user profile
- `DELETE /users/profile` - Delete user account

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DB_HOST | Database host address | Yes |
| DB_PORT | Database port | Yes |
| DB_USERNAME | Database username | Yes |
| DB_PASSWORD | Database password | Yes |
| DB_NAME | Database name | Yes |
| GOOGLE_CLIENT_ID | Google OAuth Client ID | Yes |
| GOOGLE_CLIENT_SECRET | Google OAuth Client Secret | Yes |
| GOOGLE_CALLBACK_URL | Google OAuth callback URL | Yes |
| JWT_SECRET | JWT signing secret | Yes |
| JWT_EXPIRATION | JWT expiration time | Yes |
| PAYSTACK_SECRET_KEY | Paystack secret key | Yes |
| PAYSTACK_BASE_URL | Paystack API base URL | Yes |

## Database Setup

This project uses TypeORM with PostgreSQL. To set up your database:

1. Ensure PostgreSQL is running
2. Update your database configuration in the `.env` file
3. Run migrations to create tables (if implemented):
```bash
npm run typeorm migration:run
```

## Security

This application implements several security measures:
- JWT-based authentication with refresh tokens
- Password hashing using bcrypt
- Input validation and sanitization
- Secure session management
- OAuth 2.0 with Google
- HTTPS enforcement in production
- SQL injection prevention via TypeORM

## API Documentation

API documentation is available through Swagger UI once implemented. By default, it will be available at:
- `http://localhost:3000/api` - Swagger UI
- `http://localhost:3000/api-json` - OpenAPI JSON

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
