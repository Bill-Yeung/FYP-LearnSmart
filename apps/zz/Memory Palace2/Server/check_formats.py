#!/usr/bin/env python3
"""
Check what file formats are available in the raw Polyhaven data
"""
import psycopg2
from psycopg2.extras import RealDictCursor
import json

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'admin',
    'password': 'password',
    'database': 'learning_platform'
}

conn = psycopg2.connect(**DB_CONFIG)
cursor = conn.cursor(cursor_factory=RealDictCursor)

# Get one complete record to see the structure
cursor.execute("SELECT * FROM asset_library LIMIT 1;")
asset = cursor.fetchone()

print("=" * 80)
print("SAMPLE ASSET STRUCTURE")
print("=" * 80)
print(f"\nID: {asset['id']}")
print(f"External ID: {asset['external_id']}")
print(f"Name: {asset['name']}")
print(f"Source: {asset['source']}")
print(f"Type: {asset['asset_type']}")
print(f"\nRAW API DATA:")
print(json.dumps(asset['raw_api_data'], indent=2))

# Check what formats are available across all assets
cursor.execute("SELECT raw_api_data FROM asset_library LIMIT 10;")
assets = cursor.fetchall()

all_formats = set()
for asset in assets:
    data = asset['raw_api_data']
    if 'files' in data:
        for format_key in data['files'].keys():
            all_formats.add(format_key)

print("\n" + "=" * 80)
print("AVAILABLE FORMATS ACROSS SAMPLE ASSETS:")
print("=" * 80)
for fmt in sorted(all_formats):
    print(f"  - {fmt}")

cursor.close()
conn.close()
