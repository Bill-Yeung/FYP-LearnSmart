"""
Database Schema Initialization
Creates tables for users, students, and courses if they don't exist
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'admin',
    'password': 'password',
    'database': 'learning_platform'
}

def init_database():
    """Initialize database tables"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                role VARCHAR(20) DEFAULT 'student',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create students table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) UNIQUE NOT NULL,
                student_id VARCHAR(50),
                school VARCHAR(255),
                grade VARCHAR(20),
                bio TEXT,
                profile_picture_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        """)
        
        # Create courses table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS courses (
                id SERIAL PRIMARY KEY,
                course_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                instructor VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create enrollments table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS enrollments (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                course_id VARCHAR(50) NOT NULL,
                enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
                UNIQUE(user_id, course_id)
            )
        """)
        
        conn.commit()
        logger.info("✅ Database tables initialized successfully")
        
        # Insert demo courses if not exist
        cursor.execute("SELECT COUNT(*) FROM courses")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO courses (course_id, name, description, instructor)
                VALUES 
                    ('CS101', 'Introduction to Computer Science', 'Learn the basics of programming', 'Dr. Smith'),
                    ('MATH101', 'Algebra Fundamentals', 'Master algebraic concepts', 'Prof. Johnson'),
                    ('ART101', 'Art History Basics', 'Explore world art movements', 'Ms. Lee')
            """)
            conn.commit()
            logger.info("✅ Demo courses inserted")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"❌ Database initialization error: {e}")
        raise

if __name__ == "__main__":
    init_database()
