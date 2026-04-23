#!/usr/bin/env python3
"""
Download Google Sheets as CSV files.
Reads URLs from google_sheets_links.txt and downloads each sheet.
Downloads both the first sheet and the "DE" tab.

Requires: pip install pandas openpyxl
"""

import os
import re
import sys
import urllib.request
from pathlib import Path
import openpyxl

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    print('ERROR: pandas not installed')
    print('Please run: pip install pandas openpyxl')
    sys.exit(1)


def extract_spreadsheet_id(url):
    """Extract the spreadsheet ID from a Google Sheets URL."""
    match = re.search(r'/d/([a-zA-Z0-9-_]+)', url)
    if match:
        return match.group(1)
    return None


def download_sheet_as_csv(spreadsheet_id, output_dir, date_folder):
    """Download the first sheet of a Google Sheet as CSV."""
    csv_url = f'https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv'
    folder_path = os.path.join(output_dir, date_folder)
    Path(folder_path).mkdir(parents=True, exist_ok=True)
    output_file = os.path.join(folder_path, f'{spreadsheet_id}.csv')

    try:
        urllib.request.urlretrieve(csv_url, output_file)
        return True
    except Exception as e:
        print(f'  ✗ Error downloading first sheet: {e}')
        return False


def download_de_sheet(spreadsheet_id, output_dir, date_folder):
    """Download the 'DE' tab from a Google Sheet."""
    xlsx_url = f'https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=xlsx'
    temp_file = f'/tmp/{spreadsheet_id}_temp.xlsx'
    folder_path = os.path.join(output_dir, date_folder)
    Path(folder_path).mkdir(parents=True, exist_ok=True)
    output_file = os.path.join(folder_path, f'{spreadsheet_id}_DE.csv')

    try:
        # Download Excel file
        urllib.request.urlretrieve(xlsx_url, temp_file)

        # Read the DE sheet
        df = pd.read_excel(temp_file, sheet_name='DE')

        # Save as CSV
        df.to_csv(output_file, index=False)

        # Clean up temp file
        os.remove(temp_file)

        return True
    except Exception as e:
        # Clean up temp file if it exists
        if os.path.exists(temp_file):
            os.remove(temp_file)
        print(f'  ✗ Error downloading DE sheet: {e}')
        return False


def main():
    # Read the links file
    links_file = 'google_sheets_links.txt'

    if not os.path.exists(links_file):
        print(f'Error: {links_file} not found')
        sys.exit(1)

    with open(links_file, 'r') as f:
        lines = f.readlines()

    # Extract spreadsheet IDs with their dates
    # Format: M/D/YY,URL
    sheet_data = {}  # {sheet_id: date}
    for line in lines:
        line = line.strip()
        if line and 'docs.google.com/spreadsheets' in line:
            # Extract date (format: M/D/YY,URL)
            date_match = re.match(r'(\d{1,2}/\d{1,2}/\d{2})\s*,\s*(.+)', line)
            if date_match:
                date_str = date_match.group(1)
                url = date_match.group(2)
                sheet_id = extract_spreadsheet_id(url)
                if sheet_id:
                    # Convert M/D/YY to YYYY-MM-DD for folder names
                    month, day, year = date_str.split('/')
                    full_year = f'20{year}'
                    formatted_date = f'{full_year}-{month.zfill(2)}-{day.zfill(2)}'
                    sheet_data[sheet_id] = formatted_date

    print(f'Found {len(sheet_data)} unique Google Sheets to download\n')

    # Download each sheet
    success_count_main = 0
    success_count_de = 0

    for i, (sheet_id, date) in enumerate(sorted(sheet_data.items()), 1):
        print(f'[{i}/{len(sheet_data)}] {sheet_id} - {date}')

        # Download first sheet
        if download_sheet_as_csv(sheet_id, '', date):
            print(f'  ✓ First sheet downloaded')
            success_count_main += 1

        # Download DE sheet
        if download_de_sheet(sheet_id, '', date):
            print(f'  ✓ DE sheet downloaded')
            success_count_de += 1

    print(f'\n✓ Successfully downloaded {success_count_main}/{len(sheet_data)} main sheets')
    print(f'✓ Successfully downloaded {success_count_de}/{len(sheet_data)} DE sheets')
    print(f'\nFiles saved to: downloaded_sheets/')


if __name__ == '__main__':
    main()
