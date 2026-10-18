import logging
import os
from logging.handlers import RotatingFileHandler

def get_logger(name: str = "HRMS_RAG_APP") -> logging.Logger:
    logger = logging.getLogger(name)
    
    # Avoid adding duplicate handlers if get_logger is called multiple times
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    # Standard Log Format: [YYYY-MM-DD HH:MM:SS] [INFO] [main.py:120] - Message
    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(filename)s:%(lineno)d] - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # 1. File Handler (Writes to app.log, rotates at 5 MB, keeps last 3 files)
    file_handler = RotatingFileHandler(
        "app.log", maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    # 2. Console Handler (Writes to terminal)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger

# Global instance to import across your app
logger = get_logger()