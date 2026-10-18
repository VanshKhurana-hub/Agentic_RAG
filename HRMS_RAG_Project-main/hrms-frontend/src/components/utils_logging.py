import logging
import time
from functools import wraps
from logging.handlers import RotatingFileHandler
from contextvars import ContextVar

# 1. Create a ContextVar to hold the active session_id across the async pipeline
current_session_id: ContextVar[str] = ContextVar("current_session_id", default="N/A")

# 2. Custom Logging Filter to automatically inject [Session: ID] into log lines
class SessionIdFilter(logging.Filter):
    def filter(self, record):
        record.session_id = current_session_id.get()
        return True

# ==========================================================
# 0. LOGGER CONFIGURATION (Writes to app.log & Terminal)
# ==========================================================
def setup_logger(name: str = "HRMS_RAG_APP") -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)
    
    # Notice [%(session_id)s] is now part of the standard format!
    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [Session: %(session_id)s] [%(filename)s:%(lineno)d] - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    file_handler = RotatingFileHandler(
        "app.log", maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    logger.addFilter(SessionIdFilter())  # <--- Attach Session Filter
    return logger

logger = setup_logger()


# ==========================================================
# STEP TIMER DECORATOR (@log_step)
# ==========================================================
def log_step(step_name: str):
    """Decorator to log start, success, session ID, and exact millisecond duration."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger.info(f"▶ START STEP: {step_name}")
            start_time = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                elapsed_ms = (time.perf_counter() - start_time) * 1000
                logger.info(
                    f"✔ COMPLETED STEP: {step_name} | Time Taken: {elapsed_ms:.2f} ms"
                )
                return result
            except Exception as e:
                elapsed_ms = (time.perf_counter() - start_time) * 1000
                logger.error(
                    f"✖ FAILED STEP: {step_name} | Time Taken: {elapsed_ms:.2f} ms | Error: {str(e)}",
                    exc_info=True,
                )
                raise
        return wrapper
    return decorator