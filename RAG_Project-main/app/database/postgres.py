import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# Load PostgreSQL connection URL from environment variables or default local config
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:khurana2222@localhost:5432/hrms_db"
)

# Initialize SQLAlchemy Engine and Session factory
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI dependency to yield a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def fetch_employee_leave_data(employee_id: str):
    """
    Queries the PostgreSQL database for an employee's live leave balances.
    Used by the agent tool in services/tools.py.
    """
    try:
        with engine.connect() as connection:
            # Parameterized query to prevent SQL injection
            query = text(
                """
                SELECT casual_leave, sick_leave, earned_leave 
                FROM employee_leaves 
                WHERE emp_id = :emp_id
                """
            )
            result = connection.execute(query, {"emp_id": employee_id}).fetchone()
            
            if not result:
                return None
                
            return {
                "casual": result[0],
                "sick": result[1],
                "earned": result[2]
            }
    except Exception as e:
        print(f"PostgreSQL Query Error: {str(e)}")
        return None