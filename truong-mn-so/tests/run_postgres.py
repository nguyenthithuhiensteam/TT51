"""Chạy toàn bộ kiểm thử trên Postgres nhúng (pgserver): python tests/run_postgres.py [tham số pytest]."""
import os
import subprocess
import sys
import tempfile

import pgserver

server = pgserver.get_server(tempfile.mkdtemp(prefix="tmns-pg-"), cleanup_mode="stop")
try:
    uri = server.get_uri()
    env = {**os.environ, "TEST_DATABASE_URL": uri, "DATABASE_URL": uri}
    sys.exit(subprocess.call([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", *sys.argv[1:]], env=env))
finally:
    server.cleanup()
