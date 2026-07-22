FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic/versions/0005_profile_avatars.py ./alembic/versions/0005_profile_avatars.py
COPY alembic/versions/0006_message_replies.py ./alembic/versions/0006_message_replies.py
COPY alembic/versions/0007_admin_user_analytics.py ./alembic/versions/0007_admin_user_analytics.py
COPY alembic.ini ./alembic.ini
COPY web_dist ./web_dist

RUN test -f ./alembic/versions/0005_profile_avatars.py && test -f ./alembic/versions/0006_message_replies.py && test -f ./alembic/versions/0007_admin_user_analytics.py && alembic heads | grep -q '0007_admin_user_analytics'

EXPOSE 10000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
