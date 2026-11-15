# VYRA Health OS (H²OS)

**Prototype Human Health Operating System**

> *A unified platform to track nutrition, fitness, habits, and intelligent health insights with rule-based workout generation and dynamic health scoring.*

---

## Key Features

- **Nutrition Tracking**: Meal logging with macro analysis and health scoring.
- **Habit Management**: Daily habit tracking with streaks and completion analytics.
- **Fitness Intelligence**: Dynamic workout generation based on environmental conditions.
- **Health Insights**: Near real-time analytics and trend analysis.
- **Data Persistence**: SQLite database (`vyra.db`) with full CRUD operations.
- **Authentication**: JWT-based user authentication system.
- **Export Capabilities**: CSV and structured report generation.

---

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), custom CSS design system, Chart.js.
- **Backend**: FastAPI (Python 3.11+), SQLite, Pydantic, SlowAPI rate limiting, python-jose (JWT).

---

## Running Locally

### Backend Setup
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend Setup
Open `index.html` in your browser or serve using a static file server:
```bash
# e.g., with Python
python -m http.server 3000
```

---

## Documentation

See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) for detailed architectural specifications, endpoint schemas, and data flow models.
