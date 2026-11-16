"""Supervise the RQ worker and scheduler in one daemon container.

Vercel Daemons are long-running containers. Running both processes here keeps
the deployment to one small instance while preserving their separate loops and
shutdown behaviour. If either child exits unexpectedly the supervisor stops
the other and exits so Vercel restarts the daemon.
"""

from __future__ import annotations

import logging
import signal
import subprocess
import sys
import time

from .logging import configure_logging

log = logging.getLogger(__name__)


def main() -> int:
    configure_logging()
    children = {
        "worker": subprocess.Popen([sys.executable, "-m", "app.worker"]),
        "scheduler": subprocess.Popen([sys.executable, "-m", "app.scheduler"]),
    }
    stopping = False

    def shutdown(signum: int, _frame: object) -> None:
        nonlocal stopping
        if stopping:
            return
        stopping = True
        for child in children.values():
            if child.poll() is None:
                try:
                    child.send_signal(signum)
                except ProcessLookupError:
                    pass

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    log.info(
        "daemon_started",
        extra={
            "fields": {
                "workerPid": children["worker"].pid,
                "schedulerPid": children["scheduler"].pid,
            }
        },
    )

    exit_code = 0
    while True:
        for name, child in children.items():
            code = child.poll()
            if code is not None and not stopping:
                log.error("daemon_child_exited", extra={"fields": {"child": name, "code": code}})
                exit_code = code or 1
                stopping = True
                for other in children.values():
                    if other.poll() is None:
                        other.terminate()
        if stopping and all(child.poll() is not None for child in children.values()):
            break
        time.sleep(1)

    for child in children.values():
        try:
            child.wait(timeout=30)
        except subprocess.TimeoutExpired:
            child.kill()
    log.info("daemon_stopped", extra={"fields": {"code": exit_code}})
    return 0 if stopping and exit_code == 0 else exit_code


if __name__ == "__main__":
    raise SystemExit(main())
