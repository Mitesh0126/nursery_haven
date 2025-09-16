
# Nursery Haven

A full-stack web application for nursery management with plant catalog, user authentication, and order management.

## Features

- 🌱 Plant catalog with categories and search
- 👤 User authentication (login/register)
- 🛒 Shopping cart and order management
- 👨‍💼 Admin dashboard for managing plants and orders
- 📱 Responsive design for mobile and desktop

## Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- bcryptjs for password hashing

### Frontend
- HTML5, CSS3, JavaScript
- Bootstrap 5
- Font Awesome icons

## Project Structure

```
nursery-haven/
├── backend/           # Backend API server
│   ├── server.js     # Main server file
│   └── package.json  # Backend dependencies
├── frontend/         # Frontend static files
│   ├── index.html    # Main page
│   ├── admin.html    # Admin dashboard
│   ├── login.html    # Authentication page
│   ├── script.js     # Main JavaScript
│   ├── admin.js      # Admin JavaScript
│   └── style.css     # Stylesheets
└── package.json      # Root package.json
```

## Installation & Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd nursery-haven
```

2. Install dependencies:
```bash
npm run install-all
```

3. Set up environment variables:
Create a `.env` file in the backend directory:
```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5000
```

4. Start the application:
```bash
npm start
```

The application will be available at `http://localhost:5000`

## Admin Access

Default admin credentials:
- Email: `admin`
- Password: `admin`

## Deployment

### Backend (Replit/Vercel)
Deploy the `backend` folder to your preferred backend hosting service.

### Frontend (Netlify/Vercel)
Deploy the `frontend` folder to your preferred static hosting service.

Make sure to update the API_BASE_URL in `frontend/script.js` to point to your deployed backend.

## License

ISC
