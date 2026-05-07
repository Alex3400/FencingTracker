#!/usr/bin/env python3
"""
Extract Google Sheets links and their dates from WhatsApp chat export format.
Output format: M/D/YY,URL (matching google_sheets_links.txt format)
"""

import re
import sys
from datetime import datetime
from pathlib import Path


def parse_whatsapp_date(date_str):
    """
    Parse WhatsApp date format (DD/MM/YYYY) and convert to M/D/YY format.

    Args:
        date_str: Date string in format "DD/MM/YYYY"

    Returns:
        String in format "M/D/YY" or None if parsing fails
    """
    try:
        # Parse DD/MM/YYYY format
        dt = datetime.strptime(date_str, "%d/%m/%Y")
        # Convert to M/D/YY format (remove leading zeros)
        return f"{dt.month}/{dt.day}/{str(dt.year)[2:]}"
    except ValueError:
        return None


def extract_google_sheets_links(input_file, output_file=None):
    """
    Extract Google Sheets links from WhatsApp chat format.
    Removes duplicates based on unique sheet ID.

    Args:
        input_file: Path to input text file
        output_file: Optional path to output file (prints to stdout if not provided)
    """
    # Regex patterns
    # WhatsApp message format: DD/MM/YYYY, HH:MM - Name: Message
    date_pattern = r'^(\d{2}/\d{2}/\d{4}), \d{2}:\d{2} - '
    # Google Sheets URL pattern
    sheets_pattern = r'https://docs\.google\.com/spreadsheets/d/([\w-]+)(?:/[^\s]*)?'

    results = []
    seen_sheet_ids = set()
    current_date = None

    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()

            # Check if line starts with a date
            date_match = re.match(date_pattern, line)
            if date_match:
                current_date = date_match.group(1)

            # Check for Google Sheets links in the line
            sheets_matches = re.finditer(sheets_pattern, line)

            if current_date:
                # Convert date format
                formatted_date = parse_whatsapp_date(current_date)
                if formatted_date:
                    for match in sheets_matches:
                        sheet_id = match.group(1)
                        # Only add if we haven't seen this sheet ID before
                        if sheet_id not in seen_sheet_ids:
                            url = match.group(0)
                            results.append((formatted_date, url))
                            seen_sheet_ids.add(sheet_id)

    # Write results
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            for i, (date, url) in enumerate(results, 1):
                f.write(f"{i}\t{date},{url}\n")
        print(f"Extracted {len(results)} Google Sheets links to {output_file}")
    else:
        for i, (date, url) in enumerate(results, 1):
            print(f"{date},{url}")

    return results


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_google_sheets.py <input_file> [output_file]")
        print("\nExample:")
        print("  python extract_google_sheets.py chat.txt")
        print("  python extract_google_sheets.py chat.txt output.txt")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    if not Path(input_file).exists():
        print(f"Error: Input file '{input_file}' not found")
        sys.exit(1)

    extract_google_sheets_links(input_file, output_file)


if __name__ == "__main__":
    main()
