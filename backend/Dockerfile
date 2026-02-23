FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for psycopg2 and others
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose port
EXPOSE 8000

# Run alembic migrations and start FastAPI app
CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000
