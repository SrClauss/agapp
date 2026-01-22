# Background Jobs Documentation

This document describes the background jobs used in AgApp and how to set them up.

## Featured Projects Expiration Job

### Purpose
Removes the `is_featured` flag from projects where the `featured_until` date has passed.

### Location
`backend/app/jobs/expire_featured_projects.py`

### Running Manually
```bash
cd backend
python -m app.jobs.expire_featured_projects
```

### Setting up Cron Job

To run this job every hour, add the following to your crontab:

```bash
# Open crontab editor
crontab -e

# Add this line to run every hour at minute 0
0 * * * * cd /path/to/agapp/backend && /path/to/python -m app.jobs.expire_featured_projects >> /var/log/agapp/featured_expiry.log 2>&1
```

For example, if your app is deployed at `/opt/agapp` and using a virtual environment:
```bash
0 * * * * cd /opt/agapp/backend && /opt/agapp/backend/venv/bin/python -m app.jobs.expire_featured_projects >> /var/log/agapp/featured_expiry.log 2>&1
```

### Alternative: Using systemd timer

Create a systemd service file `/etc/systemd/system/agapp-expire-featured.service`:
```ini
[Unit]
Description=AgApp Featured Projects Expiration
After=network.target

[Service]
Type=oneshot
User=www-data
WorkingDirectory=/opt/agapp/backend
Environment="PATH=/opt/agapp/backend/venv/bin"
ExecStart=/opt/agapp/backend/venv/bin/python -m app.jobs.expire_featured_projects
StandardOutput=journal
StandardError=journal
```

Create a systemd timer file `/etc/systemd/system/agapp-expire-featured.timer`:
```ini
[Unit]
Description=Run AgApp Featured Projects Expiration hourly

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start the timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable agapp-expire-featured.timer
sudo systemctl start agapp-expire-featured.timer
sudo systemctl status agapp-expire-featured.timer
```

### Docker Setup

If running in Docker, you can add the cron job to your Dockerfile or docker-compose:

#### Option 1: Add to Dockerfile
```dockerfile
# Install cron
RUN apt-get update && apt-get install -y cron

# Add cron job
RUN echo "0 * * * * cd /app/backend && python -m app.jobs.expire_featured_projects >> /var/log/cron.log 2>&1" | crontab -

# Make sure cron is running
CMD cron && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### Option 2: Separate container in docker-compose.yml
```yaml
services:
  backend:
    # ... existing backend service

  cron:
    build: ./backend
    command: >
      bash -c "
        while true; do
          python -m app.jobs.expire_featured_projects
          sleep 3600
        done
      "
    environment:
      - MONGODB_URL=${MONGODB_URL}
      - MONGODB_DB_NAME=${MONGODB_DB_NAME}
```

### Environment Variables Required

The job needs the following environment variables:
- `MONGODB_URL`: MongoDB connection string
- `MONGODB_DB_NAME`: MongoDB database name

These should match your application's `.env` configuration.

### Monitoring

Check logs to verify the job is running:
```bash
# For cron
tail -f /var/log/agapp/featured_expiry.log

# For systemd
journalctl -u agapp-expire-featured.service -f

# For Docker
docker logs -f <cron-container-name>
```

### Testing

To test the job works correctly:

1. Create a test featured project with an expired `featured_until` date
2. Run the job manually: `python -m app.jobs.expire_featured_projects`
3. Verify the project's `is_featured` flag is now `False`

```python
# Test in Python shell
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import asyncio

async def test():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.agapp
    
    # Create test project with expired featured status
    await db.projects.insert_one({
        "_id": "test_featured",
        "title": "Test",
        "is_featured": True,
        "featured_until": datetime.now(timezone.utc) - timedelta(hours=1)
    })
    
    # Run job
    from app.jobs.expire_featured_projects import expire_featured_projects
    count = await expire_featured_projects()
    print(f"Expired {count} projects")
    
    # Verify
    project = await db.projects.find_one({"_id": "test_featured"})
    print(f"is_featured: {project['is_featured']}")  # Should be False
    
    # Cleanup
    await db.projects.delete_one({"_id": "test_featured"})
    client.close()

asyncio.run(test())
```
