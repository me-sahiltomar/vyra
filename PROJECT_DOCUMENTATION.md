# VYRA Health OS - Comprehensive Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Core Functionalities](#core-functionalities)
5. [Frontend Components](#frontend-components)
6. [Backend Services](#backend-services)
7. [API Endpoints](#api-endpoints)
8. [Data Flow](#data-flow)
9. [Database Schema](#database-schema)
10. [Security Features](#security-features)
11. [MVP Scope](#mvp-scope)
12. [Limitations](#limitations)
13. [Setup & Deployment](#setup--deployment)

---

## Project Overview

**VYRA Health OS (H²OS)** is a prototype Human Health Operating System that provides users with a unified platform to track nutrition, fitness, habits, and health insights. The system features a modern web interface with near real-time data synchronization, rule-based workout generation, and intelligent health scoring.

### Key Features
- **Nutrition Tracking**: Meal logging with macro analysis and health scoring
- **Habit Management**: Daily habit tracking with streaks and completion analytics
- **Fitness Intelligence**: Dynamic workout generation based on environmental conditions
- **Health Insights**: Near real-time analytics and trend analysis
- **Data Persistence**: SQLite database with full CRUD operations
- **Authentication**: JWT-based user authentication system
- **Export Capabilities**: CSV and text report generation

---

## Architecture

### System Architecture
```
Frontend (Vanilla JS) HTTP/REST API Backend (FastAPI)
     |                                      |
     |                                      |
     +--------------------------------------+
                                      |
                                      SQLite DB (vyra.db)
```

### Technology Stack

#### Frontend
- **Language**: Vanilla JavaScript (ES6+)
- **UI**: Custom CSS with CSS variables and design system
- **Charts**: Chart.js for data visualization
- **Architecture**: Component-based with centralized state management

#### Backend
- **Framework**: FastAPI (Python 3.13+)
- **Database**: SQLite with connection pooling
- **Authentication**: JWT with bcrypt password hashing
- **Validation**: Pydantic models with custom validators
- **Rate Limiting**: SlowAPI for API protection

---

## Project Structure

```
VYRA-p9/VYRA/
Frontend/
  index.html          # Main application HTML
  api.js              # Central API layer & state management
  app.js              # Main application logic
  auth.js             # Authentication handling
  habits.js           # Habit tracking module
  nutrition.js        # Nutrition tracking module
  style.css           # Design system & styles
Backend/
  main.py             # FastAPI application entry point
  config.py           # Configuration management
  logger.py           # Request/response logging
  requirements.txt    # Python dependencies
  .env                # Environment variables
  middleware/         # Custom middleware
    csrf.py         # CSRF protection
  routes/             # API route handlers
    core.py         # Core endpoints (nutrition, habits, health)
    extended.py     # Extended endpoints (fitness, insights, environment)
    auth.py         # Authentication endpoints
    export.py       # Data export endpoints
  services/           # Business logic
    core_services.py    # Core health & nutrition logic
    extended_services.py # Fitness, insights, environment
    auth_service.py      # Authentication service
    db.py               # Database connection & schema
  schemas/            # Pydantic models
    models.py       # Request/response models
  vyra.db             # SQLite database
Documentation/
  PROJECT_DOCUMENTATION.md
```

---

## Core Functionalities

### 1. Nutrition Tracking
- **Meal Logging**: Add/remove meals with macro tracking
- **Health Scoring**: Real-time health score calculation (0-100)
- **Recommendations**: Rule-based intelligent system for nutrition suggestions
- **Goals Tracking**: Daily macro goals with progress visualization

### 2. Habit Management
- **Daily Habits**: 6 pre-configured habits with completion tracking
- **Streak System**: Automatic streak calculation and maintenance
- **Categories**: Habits organized by type (mindfulness, hydration, nutrition, fitness, sleep)
- **Completion Analytics**: Near real-time completion rates and leaderboards

### 3. Fitness Intelligence
- **Rule-Based Generation**: Dynamic workout creation based on user goals
- **Environmental Integration**: AQI-based indoor/outdoor workout recommendations
- **Activity Levels**: Beginner, Intermediate, Advanced workout scaling
- **Exercise Database**: Comprehensive exercise library with muscle group targeting

### 4. Health Insights
- **Trend Analysis**: Multi-metric trend calculations
- **Aggregated Analytics**: 7-day historical data analysis (mock data for demonstration)
- **Personalized Recommendations**: Rule-based health insights
- **Progress Tracking**: Visual progress charts and metrics

### 5. Data Management
- **Persistence**: Full SQLite database with ACID compliance
- **Export**: CSV and text report generation
- **Authentication**: Secure user management with JWT tokens
- **API Security**: Rate limiting, input validation, error handling

---

## Frontend Components

### State Management (api.js)
```javascript
const AppState = {
  user: { id: 'default', name: 'User' },
  meals: [],
  habits: [],
  waterState: null,
  sleepState: null,
  dailyMetrics: { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 },
  healthScore: 0
};
```

### Module Architecture
- **api.js**: Centralized state and API communication
- **app.js**: Main application logic and navigation
- **auth.js**: Authentication UI and token management
- **habits.js**: Habit tracking UI and interactions
- **nutrition.js**: Nutrition tracking and meal management
- **style.css**: Design system with CSS variables

### Key Features
- **Component-Based**: Modular JavaScript architecture
- **Near Real-Time Updates**: Live data synchronization
- **Responsive Design**: Mobile-first design approach
- **Loading States**: Comprehensive loading and error handling
- **Toast Notifications**: User feedback system

---

## Backend Services

### Core Services (core_services.py)
```python
# Health Score Calculation
def compute_health_score(metrics: dict[str, float]) -> int:
    """Return a 0-100 health score from current day's macro totals."""
    
# Nutrition Management
def add_meal(meal_data: dict) -> dict:
    """Persist a new meal and return it with an assigned id."""
    
# Habit Tracking
def toggle_habit(habit_id: int, done: bool) -> dict:
    """Toggle habit completion and update streak."""
```

### Extended Services (extended_services.py)
```python
# Fitness Plan Generation
def get_daily_plan(user_id: str = "default") -> dict:
    """Generate today's fitness plan based on user profile and environment."""
    
# Insights Engine
def generate_insights(user_id: str = "default") -> dict:
    """Compute aggregates from stored data and generate insights."""
    
# Environmental Intelligence
def build_environment_response(aqi: int | None = None) -> dict:
    """Build comprehensive environment intelligence response."""
```

### Authentication Service (auth_service.py)
```python
# User Management
def register_user(email: str, password: str) -> dict:
    """Register a new user with password hashing."""
    
def authenticate_user(email: str, password: str) -> dict:
    """Authenticate user and return user data."""
```

---

## API Endpoints

### Core Endpoints (/api/v1/)
```
POST   /nutrition/add-meal      # Add new meal
DELETE /nutrition/remove-meal   # Remove meal by ID
GET    /nutrition/daily         # Get daily nutrition summary

POST   /habits/update           # Toggle habit completion
GET    /habits/                 # Get full habits state
POST   /habits/log-water        # Log water intake
POST   /habits/log-sleep        # Log sleep hours

GET    /health/score            # Get health score with breakdown
GET    /health/ping             # Health check endpoint
```

### Extended Endpoints (/api/v1/)
```
GET    /fitness/today           # Get today's fitness plan
GET    /insights/               # Get health insights and trends
GET    /environment/            # Get environmental data (AQI, UV)
POST   /demo/reset              # Reset to demo state

GET    /export/nutrition/csv    # Export nutrition data as CSV
GET    /export/habits/csv       # Export habits data as CSV
GET    /export/report/pdf        # Generate health report
```

### Authentication Endpoints (/api/v1/auth/)
```
POST   /register                # User registration
POST   /login                   # User login
GET    /me                      # Get current user
POST   /logout                  # User logout
```

---

## Data Flow

### Request Flow
1. **Frontend Action** -> API Call (api.js)
2. **API Layer** -> Backend Endpoint (FastAPI)
3. **Service Layer** -> Business Logic
4. **Database** -> SQLite Operations
5. **Response** -> Frontend State Update

### Example: Adding a Meal
```javascript
// Frontend
async function addMealAPI(meal) {
  const res = await API.addMeal(meal);
  return res;
}

// Backend
@nutrition_router.post("/add-meal")
def add_meal(payload: MealInput):
  meal = nutrition.add_meal(payload.to_engine_dict())
  res = nutrition.build_nutrition_response()
  return res
```

---

## Database Schema

### Tables
```sql
-- Meals Table
CREATE TABLE meals (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    meal_type TEXT NOT NULL DEFAULT 'Snack',
    calories  REAL NOT NULL DEFAULT 0,
    protein   REAL NOT NULL DEFAULT 0,
    carbs     REAL NOT NULL DEFAULT 0,
    fats      REAL NOT NULL DEFAULT 0,
    fiber     REAL NOT NULL DEFAULT 0,
    timestamp TEXT NOT NULL
);

-- Habits Table
CREATE TABLE habits (
    id       INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    done     INTEGER NOT NULL DEFAULT 0,
    streak   INTEGER NOT NULL DEFAULT 0
);

-- Water Log Table
CREATE TABLE water_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    amount    REAL NOT NULL,
    timestamp TEXT NOT NULL,
    note      TEXT NOT NULL DEFAULT ''
);

-- Users Table
CREATE TABLE users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login   TEXT
);

-- Sleep State Table
CREATE TABLE sleep_state (
    id      INTEGER PRIMARY KEY,
    hours   REAL NOT NULL DEFAULT 0.0,
    quality INTEGER
);
```

---

## Security Features

### Authentication
- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Pydantic model validation
- **XSS Protection**: Input sanitization

### API Security
- **CORS Configuration**: Cross-origin resource sharing
- **CSRF Protection**: Token-based CSRF defense
- **Error Handling**: Secure error responses
- **Request Logging**: Comprehensive audit trail

---

## MVP Scope

This is a **prototype system** designed to demonstrate architecture and core functionality. The MVP focuses on:

### Architecture Demonstration
- Clean separation of concerns between frontend and backend
- RESTful API design with proper validation
- Centralized state management
- Modular component architecture

### Core Functionality Implementation
- Complete nutrition tracking workflow
- Habit management with persistence
- Rule-based fitness plan generation
- Basic health scoring algorithm
- Authentication system foundation

### Technology Stack Validation
- FastAPI backend with Pydantic validation
- Vanilla JavaScript frontend architecture
- SQLite database with proper schema design
- JWT authentication implementation
- Comprehensive error handling and logging

### Not Production-Ready Features
- Multi-user support (single-user system)
- Advanced analytics (limited to 7-day mock data)
- Real-time synchronization (near real-time only)
- Scalability optimizations
- Production security hardening

---

## Limitations

### System Constraints
- **Single-User System**: Designed for individual use, not multi-tenant
- **SQLite Limitations**: Not suitable for high-concurrency production use
- **Limited Historical Data**: Only 7 days of mock historical data for insights
- **No Background Processing**: All calculations happen synchronously

### Logic Limitations
- **Rule-Based System**: All recommendations follow predetermined rules, not machine learning
- **Simulated Environmental Data**: AQI and UV data are mock values for demonstration
- **No Camera Detection**: No actual image or video processing capabilities
- **Limited Personalization**: User profiles are minimal and hardcoded

### Technical Limitations
- **No Real-Time Updates**: Data updates require page refresh or manual sync
- **Limited Export Formats**: Only CSV and plain text exports available
- **No Mobile Optimization**: Responsive design but not mobile-native
- **No Offline Support**: Requires constant internet connection

### Data Limitations
- **No Data Backup**: No automated backup or recovery mechanisms
- **Limited Data Validation**: Basic input validation only
- **No Data Analytics**: Basic trend analysis only
- **No Third-Party Integrations**: No external service connections

---

## Setup & Deployment

### Prerequisites
- Python 3.13+
- Modern web browser
- Text editor or IDE

### Backend Setup
```bash
# Navigate to backend directory
cd VYRA-p9/VYRA/backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run the application
python main.py
# Or with uvicorn
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend Setup
```bash
# Navigate to project root
cd VYRA-p9/VYRA

# Start static file server
python -m http.server 3000

# The application will be available at http://localhost:3000
```

### Environment Variables (.env)
```env
DB_PATH=vyra.db
HOST=0.0.0.0
PORT=8001
RELOAD=true
APP_ENV=development
LOG_LEVEL=DEBUG
SECRET_KEY=your-secret-key-change-in-production
```

### Production Considerations
- Use PostgreSQL or MySQL for production database
- Implement proper backup and recovery
- Add comprehensive monitoring and logging
- Implement proper SSL/TLS certificates
- Consider containerization with Docker
- Add comprehensive testing suite

---

## Key Design Decisions

### Frontend Architecture
- **Vanilla JavaScript**: Chosen for simplicity and learning purposes
- **Centralized State**: Single AppState object for data consistency
- **Module-Based**: Separate files for different functionalities
- **Near Real-Time Updates**: Live synchronization with backend

### Backend Architecture
- **FastAPI**: Modern async framework with automatic documentation
- **SQLite**: Lightweight database for prototype development
- **Service Layer**: Clean separation of concerns
- **Pydantic**: Type-safe request/response validation

### Data Management
- **ACID Compliance**: Transactional database operations
- **Connection Pooling**: Efficient database connections
- **Error Handling**: Comprehensive error management
- **Logging**: Detailed request/response logging

---

## Performance Considerations

### Frontend Optimization
- **Lazy Loading**: Charts loaded on demand
- **Debouncing**: Input validation with debouncing
- **Caching**: API response caching where appropriate
- **Minification**: CSS and JavaScript minification for production

### Backend Optimization
- **Database Indexes**: Performance indexes on frequently queried columns
- **Connection Pooling**: Efficient database connection management
- **Async Operations**: Non-blocking I/O operations
- **Rate Limiting**: API protection against abuse

---

## Development Guidelines

### Code Organization
- **Single Responsibility**: Each function has a single purpose
- **DRY Principle**: Avoid code duplication
- **Type Safety**: Use type hints and Pydantic models
- **Error Handling**: Comprehensive error management

### Testing Strategy
- **Unit Tests**: Service layer testing (not implemented)
- **Integration Tests**: API endpoint testing (not implemented)
- **Frontend Tests**: UI component testing (not implemented)
- **Database Tests**: Schema and migration testing (not implemented)

---

## API Documentation

The FastAPI application provides automatic API documentation:
- **Swagger UI**: `http://localhost:8001/docs`
- **ReDoc**: `http://localhost:8001/redoc`
- **OpenAPI Schema**: `http://localhost:8001/openapi.json`

---

## UI/UX Design System

### CSS Variables
```css
:root {
  --bg: #f0f4f8;
  --surface: #ffffff;
  --text: #0d1117;
  --primary: #6366f1;
  --success: #22c55e;
  --warning: #eab308;
  --error: #ef4444;
  --radius: 16px;
  --transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Component Library
- **Buttons**: Primary, secondary, ghost variants
- **Cards**: Consistent card components
- **Forms**: Standardized form elements
- **Charts**: Consistent chart styling
- **Modals**: Reusable modal components

---

## Future Enhancements

### Planned Features
- **Multi-User Support**: Expand to multiple users with proper authentication
- **Real Database**: Migration to PostgreSQL or MySQL
- **Advanced Analytics**: More sophisticated trend analysis
- **Mobile App**: React Native application
- **Third-Party Integrations**: External service connections

### Scalability
- **Microservices**: Service decomposition for larger scale
- **Message Queue**: Async task processing
- **Caching**: Redis caching layer
- **Load Balancing**: Horizontal scaling capabilities

---

## Support & Contact

### Documentation
- **API Reference**: Automatic FastAPI documentation
- **Code Comments**: Comprehensive inline documentation
- **Examples**: Sample requests and responses

### Troubleshooting
- **Logs**: Detailed application logging
- **Health Checks**: Service health endpoints
- **Error Responses**: Structured error information

---

*This documentation provides a comprehensive overview of the VYRA Health OS prototype system structure, architecture, and implementation details. For specific implementation questions, refer to the inline code documentation and API documentation.*
