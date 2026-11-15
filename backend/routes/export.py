"""
routes/export.py
-----------------
Data export routes for CSV and PDF report generation.
"""

import logging
import csv
import io
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Response, Depends
from fastapi.responses import StreamingResponse
from schemas.models import ErrorResponse
from services.db import db_connection
from routes.auth import get_current_user
from logger import api_log

log = logging.getLogger("h2os.export")
router = APIRouter(prefix="/api/v1/export", tags=["Export"])


@router.get(
    "/nutrition/csv",
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
async def export_nutrition_csv(
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """
    Export nutrition data as CSV file.
    
    Query Parameters:
    - days: Number of days to export (default: 7, max: 90)
    
    Returns CSV file with meal data, macros, and daily totals.
    """
    if current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 90")
    
    try:
        with db_connection() as conn:
            cursor = conn.cursor()
            
            # Get meals for the specified date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            cursor.execute("""
                SELECT id, name, meal_type, calories, protein, carbs, fats, fiber, timestamp
                FROM meals 
                WHERE timestamp >= ? 
                ORDER BY timestamp DESC
            """, (start_date.strftime("%Y-%m-%dT%H:%M:%SZ"),))
            
            meals = cursor.fetchall()
            
            if not meals:
                raise HTTPException(status_code=404, detail="No nutrition data found for export")
            
            # Create CSV content
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow([
                'Date', 'Meal Type', 'Food Name', 'Calories', 
                'Protein (g)', 'Carbs (g)', 'Fats (g)', 'Fiber (g)'
            ])
            
            # Write meal data
            for meal in meals:
                date_str = datetime.strptime(meal['timestamp'], "%Y-%m-%dT%H:%M:%SZ").strftime("%Y-%m-%d")
                writer.writerow([
                    date_str,
                    meal['meal_type'],
                    meal['name'],
                    meal['calories'],
                    meal['protein'],
                    meal['carbs'],
                    meal['fats'],
                    meal['fiber']
                ])
            
            # Add daily totals summary
            writer.writerow([])  # Empty row
            writer.writerow(['DAILY TOTALS SUMMARY'])
            writer.writerow(['Date', 'Total Calories', 'Total Protein', 'Total Carbs', 'Total Fats', 'Total Fiber'])
            
            # Calculate daily totals
            daily_totals = {}
            for meal in meals:
                date = datetime.strptime(meal['timestamp'], "%Y-%m-%dT%H:%M:%SZ").strftime("%Y-%m-%d")
                if date not in daily_totals:
                    daily_totals[date] = {
                        'calories': 0, 'protein': 0, 'carbs': 0, 'fats': 0, 'fiber': 0
                    }
                
                daily_totals[date]['calories'] += meal['calories']
                daily_totals[date]['protein'] += meal['protein']
                daily_totals[date]['carbs'] += meal['carbs']
                daily_totals[date]['fats'] += meal['fats']
                daily_totals[date]['fiber'] += meal['fiber']
            
            # Write daily totals
            for date in sorted(daily_totals.keys(), reverse=True):
                totals = daily_totals[date]
                writer.writerow([
                    date,
                    totals['calories'],
                    totals['protein'],
                    totals['carbs'],
                    totals['fats'],
                    totals['fiber']
                ])
            
            # Prepare response
            output.seek(0)
            content = output.getvalue()
            
            filename = f"nutrition_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            
            api_log("GET", "/api/v1/export/nutrition/csv", {"days": days}, {"filename": filename})
            
            return Response(
                content=content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}"
                }
            )
            
    except Exception as e:
        log.error(f"Error exporting nutrition CSV: {e}")
        raise HTTPException(status_code=500, detail="Failed to export nutrition data")


@router.get(
    "/habits/csv",
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
async def export_habits_csv(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """
    Export habits data as CSV file.
    
    Query Parameters:
    - days: Number of days to export (default: 30, max: 365)
    
    Returns CSV file with habit completion data and streaks.
    """
    if current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if days < 1 or days > 365:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 365")
    
    try:
        with db_connection() as conn:
            cursor = conn.cursor()
            
            # Get current habits
            cursor.execute("SELECT id, name, category, done, streak FROM habits ORDER BY category, name")
            habits = cursor.fetchall()
            
            if not habits:
                raise HTTPException(status_code=404, detail="No habits data found for export")
            
            # Create CSV content
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow([
                'Habit ID', 'Habit Name', 'Category', 'Current Status', 
                'Current Streak', 'Export Date'
            ])
            
            # Write habits data
            export_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for habit in habits:
                writer.writerow([
                    habit['id'],
                    habit['name'],
                    habit['category'],
                    'Completed' if habit['done'] else 'Not Completed',
                    habit['streak'],
                    export_date
                ])
            
            # Add summary section
            writer.writerow([])  # Empty row
            writer.writerow(['HABITS SUMMARY'])
            
            # Calculate completion stats
            total_habits = len(habits)
            completed_habits = len([h for h in habits if h['done']])
            completion_rate = round((completed_habits / total_habits) * 100, 1) if total_habits > 0 else 0
            
            writer.writerow(['Total Habits', total_habits])
            writer.writerow(['Completed Today', completed_habits])
            writer.writerow(['Completion Rate', f"{completion_rate}%"])
            
            # Category breakdown
            writer.writerow([])  # Empty row
            writer.writerow(['CATEGORY BREAKDOWN'])
            writer.writerow(['Category', 'Total Habits', 'Completed', 'Completion Rate'])
            
            categories = {}
            for habit in habits:
                cat = habit['category']
                if cat not in categories:
                    categories[cat] = {'total': 0, 'completed': 0}
                categories[cat]['total'] += 1
                if habit['done']:
                    categories[cat]['completed'] += 1
            
            for category, stats in categories.items():
                cat_rate = round((stats['completed'] / stats['total']) * 100, 1)
                writer.writerow([category, stats['total'], stats['completed'], f"{cat_rate}%"])
            
            # Prepare response
            output.seek(0)
            content = output.getvalue()
            
            filename = f"habits_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            
            api_log("GET", "/api/v1/export/habits/csv", {"days": days}, {"filename": filename})
            
            return Response(
                content=content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}"
                }
            )
            
    except Exception as e:
        log.error(f"Error exporting habits CSV: {e}")
        raise HTTPException(status_code=500, detail="Failed to export habits data")


@router.get(
    "/report/pdf",
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
async def export_health_report(
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a comprehensive health report (text format for now).
    
    Query Parameters:
    - days: Number of days for the report (default: 7, max: 30)
    
    Returns a formatted text report with nutrition, habits, and insights.
    """
    if current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if days < 1 or days > 30:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 30")
    
    try:
        with db_connection() as conn:
            cursor = conn.cursor()
            
            # Get nutrition data
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            cursor.execute("""
                SELECT id, name, meal_type, calories, protein, carbs, fats, fiber, timestamp
                FROM meals 
                WHERE timestamp >= ? 
                ORDER BY timestamp DESC
            """, (start_date.strftime("%Y-%m-%dT%H:%M:%SZ"),))
            
            meals = cursor.fetchall()
            
            # Get habits data
            cursor.execute("SELECT id, name, category, done, streak FROM habits ORDER BY category, name")
            habits = cursor.fetchall()
            
            if not meals and not habits:
                raise HTTPException(status_code=404, detail="No data found for report generation")
            
            # Generate report content
            report_lines = []
            report_lines.append("=" * 60)
            report_lines.append("H²OS HEALTH REPORT")
            report_lines.append("=" * 60)
            report_lines.append(f"Report Period: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
            report_lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            report_lines.append("")
            
            # Nutrition Summary
            if meals:
                report_lines.append("NUTRITION SUMMARY")
                report_lines.append("-" * 30)
                
                # Calculate totals
                total_calories = sum(meal['calories'] for meal in meals)
                total_protein = sum(meal['protein'] for meal in meals)
                total_carbs = sum(meal['carbs'] for meal in meals)
                total_fats = sum(meal['fats'] for meal in meals)
                total_fiber = sum(meal['fiber'] for meal in meals)
                
                # Calculate daily averages
                avg_calories = round(total_calories / days, 1)
                avg_protein = round(total_protein / days, 1)
                avg_carbs = round(total_carbs / days, 1)
                avg_fats = round(total_fats / days, 1)
                avg_fiber = round(total_fiber / days, 1)
                
                report_lines.append(f"Total Calories: {total_calories} kcal")
                report_lines.append(f"Total Protein: {total_protein} g")
                report_lines.append(f"Total Carbs: {total_carbs} g")
                report_lines.append(f"Total Fats: {total_fats} g")
                report_lines.append(f"Total Fiber: {total_fiber} g")
                report_lines.append("")
                report_lines.append("Daily Averages:")
                report_lines.append(f"  Calories: {avg_calories} kcal/day")
                report_lines.append(f"  Protein: {avg_protein} g/day")
                report_lines.append(f"  Carbs: {avg_carbs} g/day")
                report_lines.append(f"  Fats: {avg_fats} g/day")
                report_lines.append(f"  Fiber: {avg_fiber} g/day")
                report_lines.append("")
                
                # Recent meals
                report_lines.append("RECENT MEALS (Last 10)")
                report_lines.append("-" * 30)
                for i, meal in enumerate(meals[:10]):
                    date = datetime.strptime(meal['timestamp'], "%Y-%m-%dT%H:%M:%SZ").strftime("%Y-%m-%d %H:%M")
                    report_lines.append(f"{date} - {meal['meal_type']}: {meal['name']}")
                    report_lines.append(f"  Calories: {meal['calories']} | Protein: {meal['protein']}g | Carbs: {meal['carbs']}g")
                report_lines.append("")
            
            # Habits Summary
            if habits:
                report_lines.append("HABITS SUMMARY")
                report_lines.append("-" * 30)
                
                total_habits = len(habits)
                completed_habits = len([h for h in habits if h['done']])
                completion_rate = round((completed_habits / total_habits) * 100, 1) if total_habits > 0 else 0
                
                report_lines.append(f"Total Habits: {total_habits}")
                report_lines.append(f"Completed Today: {completed_habits}")
                report_lines.append(f"Completion Rate: {completion_rate}%")
                report_lines.append("")
                
                # Habits by category
                report_lines.append("HABITS BY CATEGORY")
                report_lines.append("-" * 30)
                categories = {}
                for habit in habits:
                    cat = habit['category']
                    if cat not in categories:
                        categories[cat] = []
                    categories[cat].append(habit)
                
                for category, category_habits in categories.items():
                    report_lines.append(f"\n{category.upper()}:")
                    for habit in category_habits:
                        status = "✓" if habit['done'] else "○"
                        report_lines.append(f"  {status} {habit['name']} (Streak: {habit['streak']})")
                report_lines.append("")
            
            # Health Insights
            report_lines.append("HEALTH INSIGHTS")
            report_lines.append("-" * 30)
            
            if meals:
                # Simple insights based on data
                if avg_calories < 1800:
                    report_lines.append("• Calorie intake seems low. Consider increasing portions.")
                elif avg_calories > 2500:
                    report_lines.append("• Calorie intake is high. Focus on portion control.")
                
                if avg_protein < 50:
                    report_lines.append("• Protein intake is low. Add more lean proteins.")
                elif avg_protein > 150:
                    report_lines.append("• Excellent protein intake! Keep it up.")
                
                if avg_fiber < 20:
                    report_lines.append("• Fiber intake is low. Add more vegetables and whole grains.")
            
            if habits:
                if completion_rate >= 80:
                    report_lines.append("• Great habit consistency! You're building strong routines.")
                elif completion_rate >= 60:
                    report_lines.append("• Good habit progress. Focus on consistency.")
                else:
                    report_lines.append("• Habit consistency needs improvement. Start with smaller goals.")
            
            report_lines.append("")
            report_lines.append("=" * 60)
            report_lines.append("END OF REPORT")
            report_lines.append("=" * 60)
            
            # Prepare response
            content = "\n".join(report_lines)
            filename = f"health_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            
            api_log("GET", "/api/v1/export/report/pdf", {"days": days}, {"filename": filename})
            
            return Response(
                content=content,
                media_type="text/plain",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}"
                }
            )
            
    except Exception as e:
        log.error(f"Error generating health report: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate health report")
