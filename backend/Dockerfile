FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
COPY web_dist ./web_dist

RUN test -f ./alembic/versions/0013_beta_feedback_cooldown.py && alembic heads | grep -q '^0013_beta_feedback_cooldown'

EXPOSE 10000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
