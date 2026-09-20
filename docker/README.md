# Redis (Docker)

## Local development

```bash
docker compose up -d
```

Host publish is limited to `127.0.0.1:6379`. Do not expose Redis publicly.

## Production

Use `docker-compose.prod.yml` with `REDIS_PASSWORD` and requirepass. See [DEPLOYMENT.md](../DEPLOYMENT.md).

```bash
export REDIS_PASSWORD='YOUR_REDIS_PASSWORD'
docker compose -f docker-compose.prod.yml up -d
```

Application URL shape:

```env
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@127.0.0.1:6379
```
