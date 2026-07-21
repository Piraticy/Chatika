FROM node:20-alpine AS web-build

WORKDIR /frontend
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
ENV VITE_API_URL=/api/v1
RUN npm run build

FROM python:3.12-slim

WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./alembic.ini
COPY --from=web-build /frontend/dist ./web_dist

EXPOSE 10000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
