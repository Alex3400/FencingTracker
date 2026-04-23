import re

with open('WhatsApp Chat with HFC Adults.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

results = []
for i, line in enumerate(lines):
    url_match = re.search(r'https://docs\.google\.com/spreadsheets\S+', line)
    if url_match:
        timestamp = 'unknown'
        for j in range(i - 1, -1, -1):
            ts_match = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', lines[j])
            if ts_match:
                timestamp = ts_match.group(1)
                break
        results.append(f"{timestamp} - {url_match.group(0)}")

with open('google_sheets_links.txt', 'w') as f:
    f.write('\n'.join(results))