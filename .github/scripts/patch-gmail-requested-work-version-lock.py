from pathlib import Path

path = Path("tests/gmailThreadRouting.test.js")
text = path.read_text()
text = text.replace('/Version: 2\\.1\\.0/', '/Version: 2\\.2\\.0/', 1)
text = text.replace('GMAIL_HUMAN_ROUTING_VERSION = "2\\.1\\.0"', 'GMAIL_HUMAN_ROUTING_VERSION = "2\\.2\\.0"', 1)
path.write_text(text)
