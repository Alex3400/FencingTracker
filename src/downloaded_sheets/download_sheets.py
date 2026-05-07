#!/usr/bin/env python3
"""
Download Google Sheets as CSV files.
Reads URLs from google_sheets_links.txt and downloads each sheet.
Downloads both the first sheet and the "DE" tab.
Uses async downloads for faster processing.
Validates that sheets are poule sheets.

Requires: pip install pandas openpyxl aiohttp
"""

import os
import re
import sys
import asyncio
import tempfile
from pathlib import Path
from typing import List, Tuple, Dict

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    print('ERROR: pandas not installed')
    print('Please run: pip install pandas openpyxl aiohttp')
    sys.exit(1)

try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False
    print('ERROR: aiohttp not installed')
    print('Please run: pip install pandas openpyxl aiohttp')
    sys.exit(1)


def extract_spreadsheet_id(url):
    """Extract the spreadsheet ID from a Google Sheets URL."""
    match = re.search(r'/d/([a-zA-Z0-9-_]+)', url)
    if match:
        return match.group(1)
    return None


def validate_poule_sheet(csv_path: str) -> Tuple[bool, str]:
    """
    Validate that a CSV is a poule sheet by checking for expected columns.

    Returns:
        Tuple of (is_valid, reason)
    """
    try:
        # Read first few rows to check structure
        df = pd.read_csv(csv_path, nrows=5)

        # Check if header row (typically row 2) contains poule sheet markers
        # Look for columns like: V, D, %, TS, TR, Ind, Pl, DE
        required_columns = ['V', 'D', '%', 'TS', 'TR', 'Ind', 'Pl']

        # Check all rows for these columns (header might be in different rows)
        header_found = False
        for _, row in df.iterrows():
            row_str = ' '.join([str(x) for x in row if pd.notna(x)])
            # Check if this row contains most of the required columns
            matches = sum(1 for col in required_columns if col in row_str)
            if matches >= 5:  # At least 5 out of 7 required columns
                header_found = True
                break

        if not header_found:
            return False, "Missing poule sheet columns (V, D, %, TS, TR, Ind, Pl)"

        # Additional check: should have "Name" column
        all_text = df.to_string()
        if 'Name' not in all_text:
            return False, "Missing 'Name' column"

        return True, "Valid poule sheet"

    except Exception as e:
        return False, f"Validation error: {str(e)}"


async def download_file(session: aiohttp.ClientSession, url: str, output_path: str) -> bool:
    """Download a file asynchronously."""
    try:
        async with session.get(url) as response:
            if response.status == 200:
                content = await response.read()
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, 'wb') as f:
                    f.write(content)
                return True
            else:
                return False
    except Exception as e:
        print(f'  ✗ Download error: {e}')
        return False


async def download_sheet_as_csv(session: aiohttp.ClientSession, spreadsheet_id: str,
                                 output_dir: str, date_folder: str) -> Tuple[bool, bool, str]:
    """
    Download the first sheet of a Google Sheet as CSV.

    Returns:
        Tuple of (success, is_valid_poule_sheet, validation_message)
    """
    csv_url = f'https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv'
    folder_path = os.path.join(output_dir, date_folder)
    output_file = os.path.join(folder_path, f'{spreadsheet_id}.csv')

    success = await download_file(session, csv_url, output_file)

    if not success:
        return False, False, "Download failed"

    # Validate that it's a poule sheet
    is_valid, message = validate_poule_sheet(output_file)

    return True, is_valid, message


async def download_de_sheet(session: aiohttp.ClientSession, spreadsheet_id: str,
                            output_dir: str, date_folder: str) -> bool:
    """Download the 'DE' tab from a Google Sheet."""
    xlsx_url = f'https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=xlsx'

    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
        temp_path = temp_file.name

    folder_path = os.path.join(output_dir, date_folder)
    output_file = os.path.join(folder_path, f'{spreadsheet_id}_DE.csv')

    try:
        # Download Excel file
        success = await download_file(session, xlsx_url, temp_path)
        if not success:
            return False

        # Read the DE sheet
        df = pd.read_excel(temp_path, sheet_name='DE')

        # Save as CSV
        Path(folder_path).mkdir(parents=True, exist_ok=True)
        df.to_csv(output_file, index=False)

        return True
    except Exception as e:
        print(f'  ✗ Error processing DE sheet: {e}')
        return False
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


async def download_sheet_pair(session: aiohttp.ClientSession, sheet_id: str, date: str,
                             index: int, total: int) -> Tuple[str, str, bool, bool, str, bool]:
    """
    Download both main and DE sheets for a single spreadsheet.

    Returns:
        (sheet_id, date, main_success, is_valid, validation_message, de_success)
    """
    print(f'[{index}/{total}] {sheet_id} - {date}')

    # Download main sheet
    main_success, is_valid, message = await download_sheet_as_csv(session, sheet_id, '', date)

    if main_success:
        if is_valid:
            print(f'  ✓ Main sheet downloaded - {message}')
        else:
            print(f'  ⚠ Main sheet downloaded - WARNING: {message}')
    else:
        print(f'  ✗ Main sheet failed - {message}')

    # Download DE sheet
    de_success = await download_de_sheet(session, sheet_id, '', date)
    if de_success:
        print(f'  ✓ DE sheet downloaded')

    return sheet_id, date, main_success, is_valid, message, de_success


async def download_sheets_async(sheet_data: Dict[str, str]) -> Dict[str, any]:
    """
    Download all sheets asynchronously.

    Args:
        sheet_data: Dictionary of {sheet_id: date}

    Returns:
        Dictionary with download statistics
    """
    results = {
        'main_success': 0,
        'de_success': 0,
        'invalid_sheets': [],
        'failed_sheets': []
    }

    async with aiohttp.ClientSession() as session:
        # Create all download tasks
        tasks = [
            download_sheet_pair(session, sheet_id, date, i, len(sheet_data))
            for i, (sheet_id, date) in enumerate(sorted(sheet_data.items()), 1)
        ]

        # Run all downloads concurrently
        completed = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        for result in completed:
            if isinstance(result, Exception):
                print(f'  ✗ Unexpected error: {result}')
                continue

            sheet_id, date, main_success, is_valid, message, de_success = result

            if main_success:
                results['main_success'] += 1
                if not is_valid:
                    results['invalid_sheets'].append((sheet_id, date, message))
            else:
                results['failed_sheets'].append((sheet_id, date, 'main'))

            if de_success:
                results['de_success'] += 1

    return results


async def main_async():
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
            # Extract date (format: M/D/YY,URL or index\tM/D/YY,URL)
            # Remove leading index if present
            line = re.sub(r'^\d+\s+', '', line)
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

    # Download sheets asynchronously
    results = await download_sheets_async(sheet_data)

    # Print summary
    print(f'\n{"="*60}')
    print(f'✓ Successfully downloaded {results["main_success"]}/{len(sheet_data)} main sheets')
    print(f'✓ Successfully downloaded {results["de_success"]}/{len(sheet_data)} DE sheets')

    if results['invalid_sheets']:
        print(f'\n⚠ WARNING: {len(results["invalid_sheets"])} sheets may not be poule sheets:')
        for sheet_id, date, reason in results['invalid_sheets']:
            print(f'  - {sheet_id} ({date}): {reason}')

    if results['failed_sheets']:
        print(f'\n✗ Failed to download {len(results["failed_sheets"])} sheets:')
        for sheet_id, date, sheet_type in results['failed_sheets']:
            print(f'  - {sheet_id} ({date}) - {sheet_type} sheet')

    print(f'\nFiles saved to: downloaded_sheets/')


def main():
    asyncio.run(main_async())


if __name__ == '__main__':
    main()
