# 🎓 CampusEvents - Professional Event Management Platform

A modern, full-stack event management platform designed specifically for universities and colleges. Built with Node.js, Express, MongoDB, and featuring a beautiful light theme with white and green colors.

![CampusEvents Banner](https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80)

## ✨ Features

### 🎨 Modern Light Theme Design
- **Clean Interface**: Beautiful white and light green color scheme
- **Glass Morphism**: Modern glass effects with backdrop blur
- **Responsive Design**: Works perfectly on all devices
- **High Contrast**: Black text on light backgrounds for optimal readability
- **Professional UI**: Gradient buttons, smooth animations, and hover effects

### 🚀 Core Functionality
- **Event Management**: Create, edit, and manage campus events
- **User Authentication**: Secure registration and login system
- **Event Discovery**: Browse and search events by category
- **Registration System**: Register for events with detailed student information
- **Real-time Updates**: Live event statistics and registration counts
- **Email Notifications**: Automated email confirmations and updates

### 🤖 AI-Powered Features
- **Duplicate Detection**: Advanced AI system to prevent duplicate events
- **Smart Scheduling**: Intelligent event planning assistance
- **Analytics**: Comprehensive event performance tracking

### 🔐 Security & Performance
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Protection against spam and abuse
- **Data Validation**: Comprehensive input validation and sanitization
- **Error Handling**: Robust error handling and logging
- **MongoDB Integration**: Efficient database operations

## 🛠️ Technology Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with custom properties
- **JavaScript (ES6+)** - Interactive functionality
- **Tailwind CSS** - Utility-first CSS framework
- **AOS Library** - Smooth scroll animations
- **Font Awesome** - Professional icons

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - JSON Web Tokens for authentication
- **Bcrypt** - Password hashing
- **Nodemailer** - Email functionality

### Development Tools
- **Winston** - Logging library
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing
- **Express Rate Limit** - Rate limiting middleware
- **Compression** - Response compression

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn package manager

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/PriyanshuGurdekar01/EVENT-MANAGEMENT-WEBSITE.git
   cd EVENT-MANAGEMENT-WEBSITE
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   NODE_ENV=development
   PORT=5001
   MONGODB_URI=mongodb://localhost:27017/campusevents
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRE=30d
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   FRONTEND_URL=http://localhost:5001
   ```

4. **Start MongoDB**
   ```bash
   # On Windows
   net start MongoDB
   
   # On macOS/Linux
   sudo systemctl start mongod
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:5001`

## 🎯 Usage

### For Students
1. **Register/Login**: Create an account or sign in
2. **Browse Events**: Explore upcoming campus events
3. **Filter & Search**: Find events by category or keywords
4. **Register for Events**: Sign up for events with detailed information
5. **Manage Profile**: Update personal information and preferences

### For Event Organizers
1. **Create Events**: Add new events with comprehensive details
2. **Manage Registrations**: Track attendee registrations
3. **Analytics**: View event performance and statistics
4. **Duplicate Prevention**: AI system prevents duplicate event creation
5. **Email Notifications**: Automated communication with attendees

### For Administrators
1. **User Management**: Manage user accounts and permissions
2. **Event Oversight**: Monitor and moderate all events
3. **System Analytics**: View platform-wide statistics
4. **Content Management**: Manage platform content and settings

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Events
- `GET /api/events` - Get all events
- `POST /api/events` - Create new event
- `GET /api/events/:id` - Get specific event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `POST /api/events/:id/register` - Register for event

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/events` - Get user's events

### Admin
- `GET /api/admin/stats` - Get admin statistics
- `GET /api/admin/users` - Get all users
- `GET /api/admin/events` - Get all events (admin view)

## 🎨 Theme Customization

The application uses CSS custom properties for easy theme customization:

```css
:root {
  --primary-color: #22c55e;      /* Green primary */
  --secondary-color: #16a34a;    /* Darker green */
  --accent-color: #84cc16;       /* Lime accent */
  --text-primary: #000000;       /* Black text */
  --bg-primary: #ffffff;         /* White background */
}
```

## 📱 Responsive Design

- **Mobile First**: Optimized for mobile devices
- **Tablet Support**: Perfect tablet experience
- **Desktop Enhanced**: Full desktop functionality
- **Touch Friendly**: Optimized for touch interactions

## 🔒 Security Features

- **Password Hashing**: Bcrypt encryption
- **JWT Tokens**: Secure authentication
- **Rate Limiting**: Prevents abuse
- **Input Validation**: Comprehensive data validation
- **CORS Protection**: Cross-origin security
- **Helmet Security**: Security headers
- **MongoDB Sanitization**: Prevents injection attacks

## 📊 Performance Optimizations

- **Compression**: Gzip response compression
- **Caching**: Efficient caching strategies
- **Image Optimization**: Optimized image loading
- **Code Splitting**: Modular code organization
- **Database Indexing**: Optimized database queries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Priyanshu Gurdekar**
- GitHub: [@PriyanshuGurdekar01](https://github.com/PriyanshuGurdekar01)
- Email: priyanshugurdekar223@gmail.com

## 🙏 Acknowledgments

- Thanks to all contributors who helped improve this project
- Inspired by modern event management platforms
- Built with love for the campus community

## 📞 Support

If you have any questions or need help, please:
1. Check the [Issues](https://github.com/PriyanshuGurdekar01/EVENT-MANAGEMENT-WEBSITE/issues) page
2. Create a new issue if your problem isn't already reported
3. Contact the author directly

---

⭐ **Star this repository if you found it helpful!** ⭐