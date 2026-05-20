#!/usr/bin/env python3
"""
Database schema explorer for asset_library and asset_download tables
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Database connection details
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', '5432')),
    'user': os.environ.get('DB_USER', 'admin'),
    'password': os.environ.get('DB_PASSWORD', 'password'),
    'database': os.environ.get('DB_NAME', 'learning_platform'),
}

def explore_database():
    try:
        # Connect to PostgreSQL
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
    except Exception as e:
        print(f"Database connection error: {e}")
        print("\nPlease check:")
        print("  1. PostgreSQL server is running")
        print("  2. Database 'learning_platform' exists")
        print("  3. User 'admin' has access")
        print("  4. Password is correct")
        return

    try:
        print("=" * 80)
        print("DATABASE CONNECTION SUCCESSFUL")
        print("=" * 80)
        
        # List all tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        print("\nAvailable Tables:")
        for table in tables:
            print(f"   - {table['table_name']}")
        
        # Explore asset_library table
        for table_name in ['asset_library', 'asset_download']:
            print("\n" + "=" * 80)
            print(f"TABLE: {table_name}")
            print("=" * 80)
            
            try:
                # Check if table exists
                cursor.execute(f"""
                    SELECT column_name, data_type, character_maximum_length
                    FROM information_schema.columns
                    WHERE table_name = '{table_name}'
                    ORDER BY ordinal_position;
                """)
                columns = cursor.fetchall()
                
                if columns:
                    print(f"\nSchema for {table_name}:")
                    for col in columns:
                        print(f"   - {col['column_name']}: {col['data_type']}", end="")
                        if col['character_maximum_length']:
                            print(f" ({col['character_maximum_length']})")
                        else:
                            print()
                    
                    # Get row count
                    cursor.execute(f"SELECT COUNT(*) as count FROM {table_name};")
                    count = cursor.fetchone()['count']
                    print(f"\nTotal Records: {count}")
                    
                    # Get sample data (first 3 records)
                    if count > 0:
                        cursor.execute(f"SELECT * FROM {table_name} LIMIT 3;")
                        samples = cursor.fetchall()
                        print(f"\nSample Records:")
                        for i, sample in enumerate(samples, 1):
                            print(f"\n   Record {i}:")
                            for key, value in sample.items():
                                # Truncate long values
                                value_str = str(value)
                                if len(value_str) > 100:
                                    value_str = value_str[:100] + "..."
                                print(f"      {key}: {value_str}")
                else:
                    print(f"   Table '{table_name}' not found")
                    
            except Exception as e:
                print(f"   Error exploring {table_name}: {e}")
        
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    explore_database()
