# Default Project

## Quick Start

```bash
# Install dependencies
npm install
pip install -r requirements.txt

# Set up environment
cp .env.example .env

# Run development server
npm run dev
py -m src.main
```

## Project Structure

```
.
├── src/                # Source code
│   ├── api/            # API endpoints
│   ├── models/         # Data models
│   ├── services/       # Business logic
│   ├── utils/          # Utilities
│   └── config/         # Configuration
├── tests/              # Tests
│   ├── unit/           # Unit tests
│   └── integration/    # Integration tests
├── docs/               # Documentation
├── scripts/            # Build & utility scripts
└── .github/workflows/  # CI/CD pipelines
```

## Development

### Prerequisites
- Node.js >= 20
- Python >= 3.11
- Git

### Environment Variables

Copy `.env.example` to `.env` and fill in the values.

### Testing

```bash
# Python tests
pytest tests/

# Node.js tests
npm test
```

### Linting

```bash
# Python
ruff check src/
mypy src/

# Node.js
npm run lint
```

## License

MIT
